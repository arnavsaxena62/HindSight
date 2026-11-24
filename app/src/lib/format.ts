import type { NullableNumber } from '../types/run'

export function pct(v: NullableNumber, d = 2): string {
  if (v == null || !Number.isFinite(v)) return '-'
  return (v * 100).toFixed(d) + '%'
}

export function spct(v: NullableNumber): string {
  if (v == null || !Number.isFinite(v)) return '-'
  return (v >= 0 ? '+' : '') + pct(v)
}

export function num(v: NullableNumber, d = 2): string {
  if (v == null || !Number.isFinite(v)) return '-'
  return v.toFixed(d)
}

export function usd(v: NullableNumber): string {
  if (v == null || !Number.isFinite(v)) return '-'
  return '$' + Math.round(v).toLocaleString('en-US')
}

export function money(v: NullableNumber): string {
  if (v == null || !Number.isFinite(v)) return '-'
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'
  return '$' + (v / 1e3).toFixed(0) + 'K'
}

export function cls(v: NullableNumber): string {
  if (v == null || !Number.isFinite(v)) return ''
  return v >= 0 ? 'pos' : 'neg'
}

export function dateFromSecs(secs: number): string {
  return new Date(secs * 1000).toISOString().slice(0, 10)
}
