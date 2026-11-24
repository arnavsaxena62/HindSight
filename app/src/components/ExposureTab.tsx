import { Chart } from './Chart'
import type { Run } from '../types/run'
import { money, num, pct, usd } from '../lib/format'

interface ExposureTabProps {
  run: Run
}

export function ExposureTab({ run }: ExposureTabProps) {
  const e = run.exposure
  const summary: [string, string][] = [
    ['Time in market', pct(e.time_in_market)],
    ['Avg gross', pct(e.avg_gross)],
    ['Max gross', pct(e.max_gross)],
    ['Avg net', pct(e.avg_net)],
    ['Avg positions', num(e.avg_positions)],
    ['Max positions', String(e.max_positions)],
    ['Long share', pct(e.long_share)],
  ]

  return (
    <>
      <div className="row">
        {summary.map(([label, value]) => (
          <div className="k" key={label}>
            <small>{label}</small>
            <div>{value}</div>
          </div>
        ))}
      </div>
      <Chart
        title="EXPOSURE, % OF EQUITY"
        series={[{ n: 'Gross', k: 'gross', c: '#f5a623', step: true }]}
        data={run.series}
        fmt={(v) => pct(v, 0)}
        kf={(v) => pct(v, 1)}
        range={(_u, _min, max) => [0, Math.max(1, max)]}
      />
      <Chart
        title="CASH"
        height={200}
        series={[{ n: 'Cash', k: 'cash', c: '#2cc4d8', f: 'rgba(44,196,216,.15)', step: true }]}
        data={run.series}
        fmt={money}
        kf={usd}
      />
      <Chart
        title="OPEN POSITIONS"
        height={140}
        series={[{ n: 'Positions', k: 'positions', c: '#d8d8da', step: true }]}
        data={run.series}
        range={(_u, _min, max) => [0, Math.max(2, max)]}
      />
    </>
  )
}
