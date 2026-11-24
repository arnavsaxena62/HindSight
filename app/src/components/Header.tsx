import type { Run, RunIndexEntry } from '../types/run'

interface HeaderProps {
  index: RunIndexEntry[]
  selectedId: string
  onSelect: (id: string) => void
  run?: Run | null
  live: boolean
}

export function Header({ index, selectedId, onSelect, run, live }: HeaderProps) {
  const entry = index.find((r) => r.id === selectedId) ?? index[0]
  const meta = entry
    ? `${entry.strategy} | ${entry.symbols.length} symbols | ${entry.start} to ${entry.end} | vs ${run?.benchmark ?? 'SPY'}`
    : live
      ? 'No runs yet. Run export_run.py first.'
      : 'Select a run'

  return (
    <header>
      <b>BACKTEST</b>
      <select id="sel" value={selectedId} onChange={(e) => onSelect(e.target.value)} aria-label="Select run">
        {index.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.id})
          </option>
        ))}
      </select>
      <span className="meta" id="meta">
        {meta}
      </span>
    </header>
  )
}
