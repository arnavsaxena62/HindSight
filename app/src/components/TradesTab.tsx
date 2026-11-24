import { useState } from 'react'
import type { Run, Trade } from '../types/run'
import { cls, num, spct } from '../lib/format'

interface TradesTabProps {
  run: Run
}

const COLUMNS: { key: keyof Trade; label: string }[] = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'dir', label: 'Side' },
  { key: 'entry', label: 'Entry' },
  { key: 'exit', label: 'Exit' },
  { key: 'size', label: 'Size' },
  { key: 'entry_px', label: 'Entry px' },
  { key: 'exit_px', label: 'Exit px' },
  { key: 'pnl', label: 'PnL' },
  { key: 'ret', label: 'Return' },
]

export function TradesTab({ run }: TradesTabProps) {
  const [sort, setSort] = useState<{ key: keyof Trade; dir: 1 | -1 }>({ key: 'entry', dir: -1 })

  const rows = [...run.trades].sort((a, b) => {
    const x = a[sort.key]
    const y = b[sort.key]
    const cmp = x > y ? 1 : x < y ? -1 : 0
    return cmp * sort.dir
  })

  function toggle(key: keyof Trade) {
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))
  }

  return (
    <div className="wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} onClick={() => toggle(c.key)}>
                {c.label}
                {sort.key === c.key ? (sort.dir === 1 ? ' \u25b2' : ' \u25bc') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={`${t.symbol}-${t.entry}-${i}`}>
              <td>{t.symbol}</td>
              <td>{t.dir}</td>
              <td>{t.entry}</td>
              <td>{t.status === 'Open' ? 'open' : t.exit}</td>
              <td>{num(t.size, 2)}</td>
              <td>{num(t.entry_px)}</td>
              <td>{num(t.exit_px)}</td>
              <td className={cls(t.pnl)}>{num(t.pnl, 0)}</td>
              <td className={cls(t.ret)}>{spct(t.ret)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
