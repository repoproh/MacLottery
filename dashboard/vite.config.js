import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'stats-api',
      configureServer(server) {
        server.middlewares.use('/api/stats', (req, res) => {
          try {
            const statsPath = join(process.env.HOME, '.maclottery', 'stats.json')
            const data = readFileSync(statsPath, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          } catch {
            res.statusCode = 404
            res.end('{}')
          }
        })
      }
    }
  ],
  server: {
    port: 3456,
    host: true,
  }
})
