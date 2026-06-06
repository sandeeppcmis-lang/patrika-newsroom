import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build outputs to ../backend/public/app so PHP can serve the SPA from one host.
// For standalone hosting just deploy the generated dist/ folder.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' }
  }
})
