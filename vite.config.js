import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '127.0.0.1',
  },
  optimizeDeps: {
    entries: ['src/**/*.{js,jsx,ts,tsx}'],
  },
})
