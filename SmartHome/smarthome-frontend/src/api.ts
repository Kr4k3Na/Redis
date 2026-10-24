export type DeviceState = 'online' | 'offline' | 'warning'
export interface Device {
  id: string; name: string; type: string; room: string; state: DeviceState
  temperature?: number; humidity?: number; power?: number
  maxTemperature: number; maxPower: number; lastSeen?: string
}
export type DeviceInput = Pick<Device, 'name' | 'type' | 'room' | 'maxTemperature' | 'maxPower'>
export interface Measurement { t: number; temperature: number; humidity: number; power: number }
export interface Alert { id: string; deviceId: string; deviceName: string; event: string; value: number; timestamp: string; acknowledged: boolean }
export interface RankItem { deviceId: string; name: string; kwh: number }
export interface DayItem { day: string; kwh: number }

interface Api {
  devices(): Promise<Device[]>
  saveDevice(id: string | null, input: DeviceInput): Promise<void>
  removeDevice(id: string): Promise<void>
  measurements(id: string, hours: number): Promise<Measurement[]>
  alerts(): Promise<Alert[]>
  acknowledge(id: string): Promise<void>
  ranking(day: string): Promise<RankItem[]>
  comparison(): Promise<DayItem[]>
}

/* ---------- Pravi API (rute iz plana razvoja) ---------- */
async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.status === 204 ? (undefined as T) : r.json()
}
const real: Api = {
  devices: () => http('/api/devices'),
  saveDevice: (id, input) => id
    ? http(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(input) })
    : http('/api/devices', { method: 'POST', body: JSON.stringify(input) }),
  removeDevice: id => http(`/api/devices/${id}`, { method: 'DELETE' }),
  measurements: (id, hours) => http(`/api/devices/${id}/measurements?hours=${hours}`),
  alerts: () => http('/api/alerts'),
  acknowledge: id => http(`/api/alerts/${id}/acknowledge`, { method: 'PUT' }),
  ranking: day => http(`/api/analytics/energy-ranking?day=${day}`),
  comparison: () => http('/api/analytics/energy-comparison'),
}

/* ---------- Lažni podaci (rade bez backenda) ---------- */
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const basePower: Record<string, number> = { thermostat: 1400, fridge: 160, plug: 600, light: 60, sensor: 5 }
let seq = 105
let lastTick = 0
const devs: Device[] = [
  { id: '101', name: 'Termostat dnevne sobe', type: 'thermostat', room: 'Dnevna soba', state: 'online', maxTemperature: 28, maxPower: 2500 },
  { id: '102', name: 'Frižider', type: 'fridge', room: 'Kuhinja', state: 'online', maxTemperature: 8, maxPower: 300 },
  { id: '103', name: 'Pametna utičnica – radni sto', type: 'plug', room: 'Kancelarija', state: 'online', maxTemperature: 35, maxPower: 1000 },
  { id: '104', name: 'Senzor spavaće sobe', type: 'sensor', room: 'Spavaća soba', state: 'offline', maxTemperature: 30, maxPower: 20 },
]
const hist: Record<string, Measurement[]> = {}
const alerts: Alert[] = []

function sample(d: Device, t: number): Measurement {
  const base = d.type === 'fridge' ? 4 : 21
  return {
    t,
    temperature: base + 2.5 * Math.sin(t / 3.6e6) + rnd(-0.4, 0.4) + (d.id === '101' && Math.random() < 0.03 ? 6 : 0),
    humidity: 45 + 8 * Math.sin(t / 5e6) + rnd(-2, 2),
    power: Math.max(0, (basePower[d.type] ?? 100) * (0.6 + 0.4 * Math.abs(Math.sin(t / 2e6))) + rnd(-30, 30)),
  }
}
function seed(d: Device) {
  const now = Date.now()
  hist[d.id] = Array.from({ length: 144 }, (_, i) => sample(d, now - (143 - i) * 600_000))
}
function tick() {
  const now = Date.now()
  if (now - lastTick < 4500) return
  lastTick = now
  for (const d of devs) {
    if (!hist[d.id]) seed(d)
    if (d.state === 'offline') continue
    const m = sample(d, now)
    hist[d.id].push(m); hist[d.id] = hist[d.id].slice(-2000)
    Object.assign(d, { temperature: m.temperature, humidity: m.humidity, power: m.power, lastSeen: new Date(now).toISOString() })
    const hot = m.temperature > d.maxTemperature, heavy = m.power > d.maxPower
    d.state = hot || heavy ? 'warning' : 'online'
    const event = hot ? 'temperature_threshold_exceeded' : heavy ? 'power_threshold_exceeded' : ''
    if (event && !alerts.some(a => a.deviceId === d.id && a.event === event && !a.acknowledged))
      alerts.unshift({ id: crypto.randomUUID(), deviceId: d.id, deviceName: d.name, event, value: hot ? m.temperature : m.power, timestamp: new Date(now).toISOString(), acknowledged: false })
  }
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7) / 1000
const dailyKwh = (d: Device, day: string) => ((basePower[d.type] ?? 100) * 0.7 * 24 / 1000) * (0.8 + 0.4 * hash(day + d.id))

const mock: Api = {
  devices: async () => { tick(); return devs.map(d => ({ ...d })) },
  saveDevice: async (id, input) => {
    if (id) Object.assign(devs.find(d => d.id === id)!, input)
    else devs.push({ id: String(seq++), state: 'offline', ...input })
  },
  removeDevice: async id => { devs.splice(devs.findIndex(d => d.id === id), 1) },
  measurements: async (id, hours) => {
    tick(); const from = Date.now() - hours * 3.6e6
    return (hist[id] ?? []).filter(m => m.t >= from)
  },
  alerts: async () => { tick(); return alerts.map(a => ({ ...a })) },
  acknowledge: async id => { const a = alerts.find(a => a.id === id); if (a) a.acknowledged = true },
  ranking: async day => devs.map(d => ({ deviceId: d.id, name: d.name, kwh: +dailyKwh(d, day).toFixed(2) })).sort((a, b) => b.kwh - a.kwh),
  comparison: async () => Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10)
    return { day, kwh: +devs.reduce((s, d) => s + dailyKwh(d, day), 0).toFixed(2) }
  }),
}

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
export const api: Api = USE_MOCK ? mock : real
