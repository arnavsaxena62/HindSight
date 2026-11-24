import { useEffect, useRef, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { Series } from '../types/run'
import { dateFromSecs } from '../lib/format'

export interface ChartSeries {
  n: string
  k: keyof Series
  c: string
  f?: string
  step?: boolean
}

interface ChartProps {
  title: string
  height?: number
  series: ChartSeries[]
  data: Series
  fmt?: (v: number) => string
  kf?: (v: number) => string
  range?: (u: uPlot, min: number, max: number) => [number, number]
}

const axisStroke = '#1c1c20'

export function Chart({ title, height = 260, series, data, fmt, kf, range }: ChartProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)
  const optsRef = useRef({ fmt, kf, range })
  const [idx, setIdx] = useState<number | null>(null)

  optsRef.current = { fmt, kf, range }

  const seriesKey = series.map((s) => `${s.k}:${s.n}:${s.c}`).join('|')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    setIdx(null)

    const axis: uPlot.Axis = {
      stroke: '#7d7f86',
      grid: { stroke: axisStroke },
      ticks: { stroke: axisStroke },
      font: '11px JetBrains Mono, monospace',
      values: (_u, vals) => vals.map((v) => {
        const f = optsRef.current.fmt
        return f ? f(v) : String(v)
      }),
    }

    const opts: uPlot.Options = {
      width: Math.max(host.clientWidth, 320),
      height,
      cursor: { drag: { x: false, y: false } },
      scales: {
        x: { time: true },
        y: {
          range: (_u, min, max) => {
            const r = optsRef.current.range
            return r ? r(_u, min, max) : [min, max]
          },
        },
      },
      axes: [{ show: false }, { ...axis, size: 64 }],
      series: [
        {},
        ...series.map((s) => ({
          label: s.n,
          stroke: s.c,
          width: 1.5,
          fill: s.f,
          points: { show: false },
          paths: s.step ? uPlot.paths.stepped!({ align: 1 }) : undefined,
        })),
      ],
      hooks: {
        setCursor: [(u) => setIdx(u.cursor.idx ?? null)],
      },
    }

    const aligned = [data.t, ...series.map((s) => data[s.k])] as unknown as uPlot.AlignedData
    const plot = new uPlot(opts, aligned, host)
    plotRef.current = plot

    const observer = new ResizeObserver(() => {
      const w = host.clientWidth
      if (w > 0 && Math.abs(w - plot.width) > 1) plot.setSize({ width: w, height })
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      plot.destroy()
      plotRef.current = null
    }
    // seriesKey and data identity are the only inputs that require a rebuild
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seriesKey, height])

  const n = data.t.length
  const current = idx == null ? n - 1 : Math.min(idx, n - 1)
  const showDate = current >= 0 ? dateFromSecs(data.t[current]) : '-'
  const formatValue = optsRef.current.kf ?? ((v: number) => String(v))

  return (
    <div className="box">
      <div className="head">
        <h3>{title}</h3>
        <div className="key">
          <span className="date">{showDate}</span>
          {series.map((s) => {
            const value = data[s.k][current]
            return (
              <span key={s.k}>
                <i style={{ background: s.c }} />
                {s.n}
                <b>{value == null ? '-' : formatValue(value)}</b>
              </span>
            )
          })}
        </div>
      </div>
      <div ref={hostRef} style={{ height }} />
    </div>
  )
}
