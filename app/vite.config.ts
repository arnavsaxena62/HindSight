import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const appDir = path.dirname(fileURLToPath(import.meta.url))
const runsDir = path.resolve(appDir, '../python/runs')

interface IndexEntry {
  id: string
  name: string
  strategy: string
  symbols: string[]
  start: string
  end: string
  total_return: number | null
  cagr: number | null
  sharpe: number | null
  max_drawdown: number | null
}

function runFiles(): string[] {
  if (!fs.existsSync(runsDir)) return []
  return fs.readdirSync(runsDir).filter((n) => n.endsWith('.json') && n !== 'index.json').map((n) => n.slice(0, -5))
}

function liveIndex(): IndexEntry[] {
  const ids = new Set(runFiles())
  let stored: IndexEntry[] = []
  const indexPath = path.join(runsDir, 'index.json')
  if (fs.existsSync(indexPath)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
      if (Array.isArray(parsed)) stored = parsed as IndexEntry[]
    } catch {
      stored = []
    }
  }

  const kept = stored.filter((e) => e && typeof e.id === 'string' && ids.has(e.id))
  if (kept.length) return kept

  return [...ids].map((id) => {
    const run = JSON.parse(fs.readFileSync(path.join(runsDir, `${id}.json`), 'utf8')) as {
      name?: string
      strategy?: string
      symbols?: string[]
      start?: string
      end?: string
      metrics?: Partial<IndexEntry>
    }
    return {
      id,
      name: run.name ?? id,
      strategy: run.strategy ?? '',
      symbols: run.symbols ?? [],
      start: run.start ?? '',
      end: run.end ?? '',
      total_return: run.metrics?.total_return ?? null,
      cagr: run.metrics?.cagr ?? null,
      sharpe: run.metrics?.sharpe ?? null,
      max_drawdown: run.metrics?.max_drawdown ?? null,
    }
  })
}

function pythonRuns(): Plugin {
  return {
    name: 'python-runs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/runs/')) return next()
        const name = path.basename(url.split('?')[0])
        if (!/^[\w.-]+\.json$/.test(name)) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (name === 'index.json') {
          res.end(JSON.stringify(liveIndex()))
          return
        }
        const file = path.join(runsDir, name)
        if (!fs.existsSync(file)) return next()
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      if (!fs.existsSync(runsDir)) return
      const out = path.resolve(appDir, 'dist/runs')
      fs.mkdirSync(out, { recursive: true })
      for (const id of runFiles()) {
        fs.copyFileSync(path.join(runsDir, `${id}.json`), path.join(out, `${id}.json`))
      }
      fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(liveIndex()))
    },
  }
}

export default defineConfig({
  plugins: [react(), pythonRuns()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
