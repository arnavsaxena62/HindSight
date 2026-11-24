import type { Exposure, Metrics, Run, RunIndexEntry, Series, Trade } from '../types/run'

const SYMBOLS = ['AAPL', 'AMZN', 'GOOG', 'JPM', 'META', 'MSFT', 'NVDA', 'XOM']
const PPY = 252

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(next: () => number): number {
  const u = Math.max(next(), 1e-9)
  const v = next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function tradingDays(startISO: string, endISO: string): number[] {
  const out: number[] = []
  const d = new Date(startISO + 'T00:00:00Z')
  const end = new Date(endISO + 'T00:00:00Z')
  while (d <= end) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(Math.floor(d.getTime() / 1000))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

function round(v: number, d: number): number {
  const f = 10 ** d
  return Math.round(v * f) / f
}

function buildRun(cfg: {
  id: string
  name: string
  strategy: string
  params: Record<string, number>
  seed: number
  drift: number
  vol: number
  exposure: number
}): Run {
  const next = rng(cfg.seed)
  const t = tradingDays('2020-11-23', '2026-11-20')
  const n = t.length

  const equity: number[] = []
  const bench: number[] = []
  const drawdown: number[] = []
  const gross: number[] = []
  const cash: number[] = []
  const positions: number[] = []

  let eq = 1_000_000
  let be = 1_000_000
  let peak = eq

  for (let i = 0; i < n; i++) {
    const shock = gaussian(next)
    eq *= 1 + cfg.drift / PPY + cfg.vol * shock
    be *= 1 + 0.18 / PPY + 0.16 * (0.6 * shock + 0.8 * gaussian(next))

    const cycle = 0.5 + 0.5 * Math.sin(i / 37 + cfg.seed)
    const g = Math.max(0, Math.min(1, cfg.exposure * (0.45 + 0.9 * cycle) + 0.05 * gaussian(next)))
    peak = Math.max(peak, eq)

    equity.push(round(eq, 2))
    bench.push(round(be, 2))
    drawdown.push(round(eq / peak - 1, 6))
    gross.push(round(g, 6))
    cash.push(round(eq * (1 - g), 2))
    positions.push(Math.max(0, Math.min(8, Math.round(g * 8))))
  }

  const trades: Trade[] = []
  for (let i = 10; i < n - 12; i += 9 + Math.floor(next() * 12)) {
    const held = 5 + Math.floor(next() * 20)
    if (i + held >= n) break
    const symbol = SYMBOLS[Math.floor(next() * SYMBOLS.length)]
    const dir = next() > 0.08 ? 'long' : 'short'
    const entryPx = round(50 + next() * 400, 2)
    const ret = (next() - 0.42) * 0.14
    const exitPx = round(entryPx * (1 + (dir === 'long' ? ret : -ret)), 2)
    const size = round(eq * 0.08 / entryPx, 2)
    const pnl = round((exitPx - entryPx) * size * (dir === 'long' ? 1 : -1), 2)
    trades.push({
      symbol,
      dir,
      entry: dateFromSecs(t[i]),
      exit: dateFromSecs(t[i + held]),
      size,
      entry_px: entryPx,
      exit_px: exitPx,
      pnl,
      ret: round(ret, 6),
      status: 'Closed',
    })
  }

  const series: Series = {
    t,
    equity,
    bench,
    drawdown,
    gross,
    net: gross.slice(),
    cash,
    positions,
  }

  const rets = equity.slice(1).map((v, i) => v / equity[i] - 1)
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
  const std = Math.sqrt(variance)
  const rf = 0.0381
  const excess = rets.map((r) => r - rf / PPY)
  const exMean = excess.reduce((a, b) => a + b, 0) / excess.length
  const downside = Math.sqrt(excess.reduce((a, b) => a + Math.min(b, 0) ** 2, 0) / excess.length)
  const years = (t[n - 1] - t[0]) / 86400 / 365.25
  const total = equity[n - 1] / equity[0] - 1
  const ddMin = Math.min(...drawdown)
  const wins = trades.filter((x) => x.pnl > 0)
  const losses = trades.filter((x) => x.pnl < 0)
  const gain = wins.reduce((a, b) => a + b.pnl, 0)
  const loss = Math.abs(losses.reduce((a, b) => a + b.pnl, 0))

  const metrics: Metrics = {
    total_return: round(total, 6),
    cagr: round((1 + total) ** (1 / years) - 1, 6),
    start_value: equity[0],
    end_value: equity[n - 1],
    years: round(years, 6),
    sharpe: round(std > 0 ? (exMean / std) * Math.sqrt(PPY) : 0, 6),
    sortino: round(downside > 0 ? (exMean / downside) * Math.sqrt(PPY) : 0, 6),
    max_drawdown: round(ddMin, 6),
    max_drawdown_date: dateFromSecs(t[drawdown.indexOf(ddMin)]),
    volatility: round(std * Math.sqrt(PPY), 6),
    win_rate: round(wins.length / trades.length, 6),
    wins: wins.length,
    trade_count: trades.length,
    profit_factor: loss > 0 ? round(gain / loss, 6) : null,
    rf,
    bench_return: round(bench[n - 1] / bench[0] - 1, 6),
  }

  const invested = gross.filter((g) => g > 0.001)
  const exposure: Exposure = {
    time_in_market: round(invested.length / n, 6),
    avg_gross: round(gross.reduce((a, b) => a + b, 0) / n, 6),
    max_gross: round(Math.max(...gross), 6),
    avg_net: round(gross.reduce((a, b) => a + b, 0) / n, 6),
    avg_positions: round(positions.reduce((a, b) => a + b, 0) / Math.max(invested.length, 1), 6),
    max_positions: Math.max(...positions),
    long_share: round(wins.length / trades.length, 6),
  }

  return {
    id: cfg.id,
    name: cfg.name,
    strategy: cfg.strategy,
    params: cfg.params,
    notes: [],
    symbols: SYMBOLS,
    benchmark: 'SPY',
    capital: 1_000_000,
    start: dateFromSecs(t[0]),
    end: dateFromSecs(t[n - 1]),
    metrics,
    exposure,
    series,
    trades,
  }
}

function dateFromSecs(secs: number): string {
  return new Date(secs * 1000).toISOString().slice(0, 10)
}

export const mockRuns: Run[] = [
  buildRun({
    id: '20261124-193400',
    name: 'RSI Mean Reversion 14 30 70',
    strategy: 'RSI Mean Reversion',
    params: { window: 14, oversold: 30, overbought: 70 },
    seed: 7,
    drift: 0.09,
    vol: 0.011,
    exposure: 0.35,
  }),
  buildRun({
    id: '20261124-193401',
    name: 'SMA Crossover 20 50 200',
    strategy: 'SMA Crossover + Trend Filter',
    params: { fast: 20, slow: 50, trend: 200 },
    seed: 23,
    drift: 0.13,
    vol: 0.013,
    exposure: 0.58,
  }),
  buildRun({
    id: '20261124-193402',
    name: 'Bollinger + RSI, 8 large caps',
    strategy: 'Bollinger + RSI',
    params: { bb_window: 20, bb_alpha: 2, rsi_window: 14 },
    seed: 41,
    drift: 0.16,
    vol: 0.016,
    exposure: 0.72,
  }),
]

export function mockIndex(): RunIndexEntry[] {
  return mockRuns.map((r) => ({
    id: r.id,
    name: r.name,
    strategy: r.strategy,
    symbols: r.symbols,
    start: r.start,
    end: r.end,
    total_return: r.metrics.total_return,
    cagr: r.metrics.cagr,
    sharpe: r.metrics.sharpe,
    max_drawdown: r.metrics.max_drawdown,
  }))
}
