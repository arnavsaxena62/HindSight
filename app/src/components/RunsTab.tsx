import type { RunIndexEntry } from '../types/run'
import { cls, num, pct, spct } from '../lib/format'

interface RunsTabProps {
  runs: RunIndexEntry[]
  onSelect: (id: string) => void
}

export function RunsTab({ runs, onSelect }: RunsTabProps) {
  return (
    <div className="wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Strategy</th>
            <th>Symbols</th>
            <th>Period</th>
            <th>Return</th>
            <th>CAGR</th>
            <th>Sharpe</th>
            <th>Max DD</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr className="go" key={r.id} onClick={() => onSelect(r.id)}>
              <td>{r.name}</td>
              <td>{r.strategy}</td>
              <td>{r.symbols.length}</td>
              <td>{r.start} to {r.end}</td>
              <td className={cls(r.total_return)}>{spct(r.total_return)}</td>
              <td>{spct(r.cagr)}</td>
              <td>{num(r.sharpe)}</td>
              <td className="neg">{pct(r.max_drawdown)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
