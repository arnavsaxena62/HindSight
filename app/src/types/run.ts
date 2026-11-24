export type NullableNumber = number | null

export interface RunIndexEntry {
  id: string
  name: string
  strategy: string
  symbols: string[]
  start: string
  end: string
  total_return: NullableNumber
  cagr: NullableNumber
  sharpe: NullableNumber
  max_drawdown: NullableNumber
}

export interface Metrics {
  total_return: NullableNumber
  cagr: NullableNumber
  start_value: number
  end_value: number
  years: number
  sharpe: NullableNumber
  sortino: NullableNumber
  max_drawdown: NullableNumber
  max_drawdown_date: string
  volatility: NullableNumber
  win_rate: NullableNumber
  wins: number
  trade_count: number
  profit_factor: NullableNumber
  rf: NullableNumber
  bench_return?: NullableNumber
}

export interface Exposure {
  time_in_market: number
  avg_gross: number
  max_gross: number
  avg_net: number
  avg_positions: number
  max_positions: number
  long_share: number
}

export interface Series {
  t: number[]
  equity: NullableNumber[]
  bench: NullableNumber[]
  drawdown: NullableNumber[]
  gross: NullableNumber[]
  net: NullableNumber[]
  cash: NullableNumber[]
  positions: NullableNumber[]
}

export interface Trade {
  symbol: string
  dir: string
  entry: string
  exit: string
  size: number
  entry_px: number
  exit_px: number
  pnl: number
  ret: number
  status: string
}

export interface Run {
  id: string
  name: string
  strategy: string
  params?: Record<string, unknown>
  notes?: string[]
  symbols: string[]
  benchmark: string
  capital: number
  start: string
  end: string
  metrics: Metrics
  exposure: Exposure
  series: Series
  trades: Trade[]
}

export type TabKey = 'overview' | 'exposure' | 'trades' | 'runs'

export const TABS: TabKey[] = ['overview', 'exposure', 'trades', 'runs']
