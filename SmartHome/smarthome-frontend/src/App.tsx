import { useCallback, useEffect, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, USE_MOCK, Alert, DayItem, Device, DeviceInput, DeviceState, Measurement, RankItem } from './api'

/* ---------- pomoćno ---------- */
function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const load = useCallback(
    () => fn().then(d => { setData(d); setError(undefined) }).catch(e => setError(String(e.message ?? e))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  )
  useEffect(() => {
    load()
    if (!ms) return
    const id = setInterval(load, ms)
    return () => clearInterval(id)
  }, [load, ms])
  return { data, error, reload: load }
}
const fmt = (v?: number, unit = '', digits = 1) => (v == null ? '—' : `${v.toFixed(digits)}${unit}`)
const stateLabel: Record<DeviceState, string> = { online: 'Online', offline: 'Offline', warning: 'Upozorenje' }
const eventLabel: Record<string, string> = {
  temperature_threshold_exceeded: 'Prekoračena temperatura',
  power_threshold_exceeded: 'Prekoračena snaga',
}
const time = (t: number | string) => new Date(t).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })

function Status({ state }: { state: DeviceState }) {
  return <span className={`status ${state}`}>{stateLabel[state]}</span>
}
function ErrorBox({ error }: { error?: string }) {
  return error ? <p className="error">Greška pri učitavanju: {error}. Proveri da li API radi i da li je podešen proxy u vite.config.ts.</p> : null
}

/* ---------- Dashboard ---------- */
const metrics = {
  temperature: { label: 'Temperatura', unit: '°C', color: 'var(--accent)' },
  humidity: { label: 'Vlažnost', unit: '%', color: 'var(--blue)' },
  power: { label: 'Snaga', unit: ' W', color: 'var(--warn)' },
} as const
type Metric = keyof typeof metrics

function HistoryChart({ device }: { device: Device }) {
  const [metric, setMetric] = useState<Metric>('temperature')
  const [hours, setHours] = useState(6)
  const { data } = usePoll<Measurement[]>(() => api.measurements(device.id, hours), 10000, [device.id, hours])
  const m = metrics[metric]
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{device.name}</h2>
        <div className="tabs small">
          {(Object.keys(metrics) as Metric[]).map(k => (
            <button key={k} className={k === metric ? 'on' : ''} onClick={() => setMetric(k)}>{metrics[k].label}</button>
          ))}
        </div>
        <div className="tabs small">
          {[1, 6, 24].map(h => <button key={h} className={h === hours ? 'on' : ''} onClick={() => setHours(h)}>{h} h</button>)}
        </div>
      </div>
      {data && data.length ? (
        <div className="chart">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="t" tickFormatter={time} stroke="var(--muted)" tick={{ fontSize: 12 }} minTickGap={40} />
              <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(0)} />
              <Tooltip labelFormatter={time} formatter={(v: number) => [`${v.toFixed(1)}${m.unit}`, m.label]}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }} />
              <Area type="monotone" dataKey={metric} stroke={m.color} strokeWidth={2} fill="url(#fill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty">Još nema merenja za ovaj uređaj u izabranom intervalu.</p>
      )}
    </section>
  )
}

function Dashboard() {
  const devices = usePoll(api.devices, 5000)
  const alerts = usePoll(api.alerts, 5000)
  const [sel, setSel] = useState<string>()
  const list = devices.data ?? []
  const current = list.find(d => d.id === sel) ?? list[0]
  const active = (alerts.data ?? []).filter(a => !a.acknowledged)
  const live = list.filter(d => d.state !== 'offline')
  const totalPower = live.reduce((s, d) => s + (d.power ?? 0), 0)
  const temps = live.filter(d => d.type !== 'fridge' && d.temperature != null)
  const avgTemp = temps.length ? temps.reduce((s, d) => s + d.temperature!, 0) / temps.length : undefined

  return (
    <>
      <ErrorBox error={devices.error} />
      <div className="summary">
        <div><span>Uređaji online</span><b>{live.length} / {list.length}</b></div>
        <div><span>Aktivna upozorenja</span><b className={active.length ? 'bad' : ''}>{active.length}</b></div>
        <div><span>Ukupna snaga</span><b>{(totalPower / 1000).toFixed(2)} kW</b></div>
        <div><span>Prosečna temperatura</span><b>{fmt(avgTemp, ' °C')}</b></div>
      </div>

      <div className="grid">
        <div className="main-col">
          <div className="devices">
            {list.map(d => (
              <button key={d.id} className={`device ${d.state} ${current?.id === d.id ? 'sel' : ''}`} onClick={() => setSel(d.id)}>
                <div className="device-top"><strong>{d.name}</strong><Status state={d.state} /></div>
                <small>{d.room}</small>
                <div className="reading"><span className="big">{fmt(d.temperature, '°')}</span>
                  <span>{fmt(d.humidity, '%', 0)} vlažnost</span><span>{fmt(d.power, ' W', 0)}</span></div>
              </button>
            ))}
            {!list.length && !devices.error && <p className="empty">Nema uređaja. Dodaj prvi na stranici „Uređaji“.</p>}
          </div>
          {current && <HistoryChart device={current} />}
        </div>

        <section className="panel alerts">
          <div className="panel-head"><h2>Upozorenja</h2></div>
          {active.length === 0 && <p className="empty">Nema aktivnih upozorenja.</p>}
          {active.map(a => (
            <div key={a.id} className="alert">
              <div>
                <strong>{eventLabel[a.event] ?? a.event}</strong>
                <small>{a.deviceName} · {fmt(a.value)} · {time(a.timestamp)}</small>
              </div>
              <button className="ghost" onClick={() => api.acknowledge(a.id).then(alerts.reload)}>Označi obrađenim</button>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

/* ---------- Uređaji (CRUD) ---------- */
const types = ['thermostat', 'fridge', 'plug', 'light', 'sensor']
const empty: DeviceInput = { name: '', type: 'sensor', room: '', maxTemperature: 28, maxPower: 2500 }

function Devices() {
  const { data, error, reload } = usePoll(api.devices, 0)
  const [editing, setEditing] = useState<{ id: string | null; form: DeviceInput }>()

  const save = async () => {
    if (!editing) return
    await api.saveDevice(editing.id, editing.form)
    setEditing(undefined); reload()
  }
  const set = <K extends keyof DeviceInput>(k: K, v: DeviceInput[K]) => setEditing(e => e && { ...e, form: { ...e.form, [k]: v } })

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Uređaji</h2>
        <button className="primary" onClick={() => setEditing({ id: null, form: empty })}>Dodaj uređaj</button>
      </div>
      <ErrorBox error={error} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Naziv</th><th>Tip</th><th>Prostorija</th><th>Prag temp.</th><th>Prag snage</th><th>Stanje</th><th /></tr></thead>
          <tbody>
            {(data ?? []).map(d => (
              <tr key={d.id}>
                <td>{d.name}</td><td>{d.type}</td><td>{d.room}</td>
                <td>{d.maxTemperature} °C</td><td>{d.maxPower} W</td><td><Status state={d.state} /></td>
                <td className="actions">
                  <button className="ghost" onClick={() => setEditing({ id: d.id, form: { name: d.name, type: d.type, room: d.room, maxTemperature: d.maxTemperature, maxPower: d.maxPower } })}>Izmeni</button>
                  <button className="ghost danger" onClick={() => confirm(`Obrisati uređaj „${d.name}“?`) && api.removeDevice(d.id).then(reload)}>Obriši</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="overlay" onClick={() => setEditing(undefined)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); save() }}>
            <h2>{editing.id ? 'Izmena uređaja' : 'Novi uređaj'}</h2>
            <label>Naziv<input required value={editing.form.name} onChange={e => set('name', e.target.value)} /></label>
            <label>Tip<select value={editing.form.type} onChange={e => set('type', e.target.value)}>{types.map(t => <option key={t}>{t}</option>)}</select></label>
            <label>Prostorija<input required value={editing.form.room} onChange={e => set('room', e.target.value)} /></label>
            <div className="row">
              <label>Maks. temperatura (°C)<input type="number" value={editing.form.maxTemperature} onChange={e => set('maxTemperature', +e.target.value)} /></label>
              <label>Maks. snaga (W)<input type="number" value={editing.form.maxPower} onChange={e => set('maxPower', +e.target.value)} /></label>
            </div>
            <div className="row end">
              <button type="button" className="ghost" onClick={() => setEditing(undefined)}>Otkaži</button>
              <button className="primary">Sačuvaj</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

/* ---------- Analitika ---------- */
function Analytics() {
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10))
  const rank = usePoll<RankItem[]>(() => api.ranking(day), 0, [day])
  const cmp = usePoll<DayItem[]>(api.comparison, 0)
  const tip = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }
  return (
    <div className="two">
      <section className="panel">
        <div className="panel-head">
          <h2>Najveći potrošači</h2>
          <input type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={e => setDay(e.target.value)} />
        </div>
        <ErrorBox error={rank.error} />
        <div className="chart tall">
          <ResponsiveContainer>
            <BarChart data={rank.data ?? []} layout="vertical" margin={{ left: 20, right: 16 }}>
              <CartesianGrid stroke="var(--line)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted)" tick={{ fontSize: 12 }} unit=" kWh" />
              <YAxis type="category" dataKey="name" width={150} stroke="var(--muted)" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v} kWh`, 'Potrošnja']} contentStyle={tip} cursor={{ fill: 'var(--bg)' }} />
              <Bar dataKey="kwh" fill="var(--accent)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Potrošnja po danima (7 dana)</h2></div>
        <ErrorBox error={cmp.error} />
        <div className="chart tall">
          <ResponsiveContainer>
            <BarChart data={cmp.data ?? []} margin={{ left: -8, right: 8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} stroke="var(--muted)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} unit=" kWh" width={64} />
              <Tooltip formatter={(v: number) => [`${v} kWh`, 'Ukupno']} contentStyle={tip} cursor={{ fill: 'var(--bg)' }} />
              <Bar dataKey="kwh" fill="var(--blue)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}

/* ---------- Aplikacija ---------- */
const pages = { dashboard: 'Kontrolna tabla', devices: 'Uređaji', analytics: 'Analitika' } as const
type Page = keyof typeof pages

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  return (
    <>
      <header>
        <div className="brand"><span className="dot" />SmartHome</div>
        <nav className="tabs">
          {(Object.keys(pages) as Page[]).map(p => <button key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>{pages[p]}</button>)}
        </nav>
        {USE_MOCK && <span className="demo">Probni podaci</span>}
      </header>
      <main>{page === 'dashboard' ? <Dashboard /> : page === 'devices' ? <Devices /> : <Analytics />}</main>
    </>
  )
}
