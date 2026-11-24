import type { Run } from '../types/run'
import { cls, money, num, pct, spct } from '../lib/format'

interface KPIsProps {
  run: Run
}

interface Card {
  label: string
  value: string
  color?: string
  sub?: string
  highlight?: boolean
}

export function KPIs({ run }: KPIsProps) {
  const m = run.metrics
  const e = run.exposure

  const cards: Card[] = [
    {
      label: 'Total return',
      value: spct(m.total_return),
      color: cls(m.total_return),
      sub: `${money(m.start_value)} to ${money(m.end_value)}`,
      highlight: true,
    },
    {
      label: 'CAGR',
      value: spct(m.cagr),
      color: cls(m.cagr),
      sub: `${num(m.years, 1)} years`,
      highlight: true,
    },
    { label: 'Sharpe', value: num(m.sharpe), sub: `rf ${pct(m.rf)}` },
    { label: 'Sortino', value: num(m.sortino) },
    { label: 'Max drawdown', value: pct(m.max_drawdown), color: 'neg', sub: `trough ${m.max_drawdown_date}` },
    { label: 'Volatility', value: pct(m.volatility) },
    { label: 'Win rate', value: pct(m.win_rate), sub: `${m.wins} / ${m.trade_count} trades` },
    { label: 'Profit factor', value: m.profit_factor == null ? '-' : num(m.profit_factor) },
    { label: 'Exposure', value: pct(e.time_in_market), sub: `avg ${pct(e.avg_gross, 0)} gross` },
  ]

  return (
    <div className="kpis">
      {cards.map((c) => (
        <div className={`k${c.highlight ? ' hl' : ''}`} key={c.label}>
          <small>{c.label}</small>
          <div className={c.color ?? ''}>{c.value}</div>
          <small>{c.sub ?? '\u00a0'}</small>
        </div>
      ))}
    </div>
  )
}
