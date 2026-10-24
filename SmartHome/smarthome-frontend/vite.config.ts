import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Adresa tvog ASP.NET Core API-ja (vidi launchSettings.json), npr. https://localhost:7123
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_URL || 'http://localhost:5000'
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true, secure: false },
        '/hubs': { target, changeOrigin: true, secure: false, ws: true },
      },
    },
  }
})
