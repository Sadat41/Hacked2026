import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/HydroGrid/' : '/',
  server: {
    proxy: {
      '/arcgis': {
        target: 'https://services.arcgis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/arcgis/, ''),
      },
      '/weatherapi': {
        target: 'https://api.weather.gc.ca',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/weatherapi/, ''),
      },
    },
  },
}))
