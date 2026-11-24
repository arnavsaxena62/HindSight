import { Chart } from './Chart'
import type { Run } from '../types/run'
import { money, pct, usd } from '../lib/format'

interface OverviewTabProps {
  run: Run
}

export function OverviewTab({ run }: OverviewTabProps) {
  return (
    <>
      <Chart
        title={`EQUITY vs ${run.benchmark}`}
        series={[
          { n: 'Strategy', k: 'equity', c: '#f5a623' },
          { n: run.benchmark, k: 'bench', c: '#7d7f86' },
        ]}
        data={run.series}
        fmt={money}
        kf={usd}
      />
      <Chart
        title="DRAWDOWN"
        height={180}
        series={[{ n: 'Drawdown', k: 'drawdown', c: '#e5484d', f: 'rgba(229,72,77,.18)' }]}
        data={run.series}
        fmt={(v) => pct(v, 0)}
        kf={(v) => pct(v, 2)}
      />
    </>
  )
}
