import { useEffect, useState } from 'react'
import './App.css'
import { Header, KPIs, TabNav, OverviewTab, ExposureTab, TradesTab, RunsTab } from './components'
import { loadIndex, loadRun } from './lib/data'
import { TABS, type Run, type RunIndexEntry, type TabKey } from './types/run'

interface Route {
  runId?: string
  tab?: TabKey
}

function parseHash(): Route {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const rawTab = params.get('tab')
  const tab = TABS.find((t) => t === rawTab)
  const runId = params.get('run') ?? undefined
  return { runId, tab }
}

function writeHash(patch: Partial<Route>) {
  const next = { ...parseHash(), ...patch }
  const params = new URLSearchParams()
  if (next.runId) params.set('run', next.runId)
  if (next.tab) params.set('tab', next.tab)
  window.location.hash = params.toString()
}

function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const [index, setIndex] = useState<RunIndexEntry[]>([])
  const [live, setLive] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadIndex()
      .then((result) => {
        if (!cancelled) {
          setIndex(result.index)
          setLive(result.live)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedId =
    index.length === 0
      ? ''
      : index.some((r) => r.id === route.runId)
        ? route.runId!
        : index[0].id
  const tab: TabKey = route.tab ?? 'overview'

  useEffect(() => {
    if (!selectedId) {
      setRun(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    loadRun(selectedId)
      .then((result) => {
        if (!cancelled) {
          setRun(result)
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setRun(null)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  function selectRun(id: string) {
    writeHash({ runId: id, tab: 'overview' })
  }

  return (
    <div className="App">
      <Header index={index} selectedId={selectedId} onSelect={(id) => writeHash({ runId: id })} run={run} live={live} />
      {error && <div className="err">{error}</div>}
      {run && !error && <KPIs run={run} />}
      <TabNav currentTab={tab} onTabChange={(t) => writeHash({ tab: t })} />
      <main id="main">
        {loading && !error ? (
          <div className="err">Loading…</div>
        ) : error ? null : !run ? (
          <div className="err">No runs yet. Run export_run.py first.</div>
        ) : tab === 'overview' ? (
          <OverviewTab run={run} />
        ) : tab === 'exposure' ? (
          <ExposureTab run={run} />
        ) : tab === 'trades' ? (
          <TradesTab run={run} />
        ) : (
          <RunsTab runs={index} onSelect={selectRun} />
        )}
      </main>
    </div>
  )
}

export default App
