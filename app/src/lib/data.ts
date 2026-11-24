import { mockIndex, mockRuns } from '../data/mockRuns'
import type { Run, RunIndexEntry } from '../types/run'

function isIndex(v: unknown): v is RunIndexEntry[] {
  return Array.isArray(v) && v.every((e) => e && typeof e === 'object' && typeof e.id === 'string' && Array.isArray(e.symbols))
}

function isRun(v: unknown): v is Run {
  if (!v || typeof v !== 'object') return false
  const r = v as Partial<Run>
  return (
    typeof r.id === 'string' &&
    !!r.metrics &&
    !!r.exposure &&
    !!r.series &&
    Array.isArray(r.series.t) &&
    Array.isArray(r.trades)
  )
}

async function fetchJSON(path: string): Promise<unknown> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const text = await res.text()
  if (!text.trimStart().startsWith('[') && !text.trimStart().startsWith('{')) {
    throw new Error(`${path}: not JSON`)
  }
  return JSON.parse(text)
}

export async function loadIndex(): Promise<{ index: RunIndexEntry[]; live: boolean }> {
  try {
    const data = await fetchJSON('runs/index.json')
    if (isIndex(data)) return { index: data, live: true }
  } catch {
    // fall back to bundled demo data
  }
  return { index: mockIndex(), live: false }
}

export async function loadRun(id: string): Promise<Run> {
  try {
    const data = await fetchJSON(`runs/${encodeURIComponent(id)}.json`)
    if (isRun(data)) return data
  } catch {
    // fall back below
  }
  const local = mockRuns.find((r) => r.id === id)
  if (local) return local
  throw new Error(`Run ${id} could not be loaded`)
}
