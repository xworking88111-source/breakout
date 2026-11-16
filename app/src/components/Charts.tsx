import type { CSSProperties, ReactNode } from 'react'

export function ScoreRing({
  score,
  color,
  size = 92,
  stroke = 6,
  lang,
}: {
  score: number
  color: string
  size?: number
  stroke?: number
  lang: 'zh' | 'en'
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-inner">
        <span className="ring-score" style={{ fontSize: size * 0.3 }}>
          {score.toFixed(1)}
        </span>
        <span className="ring-unit">{lang === 'zh' ? '指數' : 'IDX'}</span>
      </div>
    </div>
  )
}

export function Radar({
  series,
  labels,
  size = 320,
  lang,
}: {
  series: { values: number[]; color: string; label?: string }[]
  labels: string[]
  size?: number
  lang: 'zh' | 'en'
}) {
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.3
  const n = labels.length
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const pt = (i: number, v: number) => {
    const rr = (Math.max(0, Math.min(100, v)) / 100) * R
    return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr]
  }
  const rings = [25, 50, 75, 100]

  return (
    <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`} className="radar" role="img">
      {rings.map((rg) => (
        <polygon
          key={rg}
          points={labels.map((_, i) => pt(i, rg).join(',')).join(' ')}
          fill="none"
          stroke={rg === 50 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'}
          strokeWidth={1}
        />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 100)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      })}
      {series.map((s, si) => (
        <polygon
          key={si}
          points={s.values.map((v, i) => pt(i, v).join(',')).join(' ')}
          fill={s.color}
          fillOpacity={series.length > 1 ? 0.12 : 0.16}
          stroke={s.color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ))}
      {series.map((s, si) =>
        s.values.map((v, i) => {
          const [x, y] = pt(i, v)
          return <circle key={`${si}-${i}`} cx={x} cy={y} r={2.6} fill={s.color} />
        }),
      )}
      {labels.map((l, i) => {
        const a = angle(i)
        const x = cx + Math.cos(a) * (R + (lang === 'zh' ? 26 : 24))
        const y = cy + Math.sin(a) * (R + (lang === 'zh' ? 26 : 24))
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
        return (
          <text key={l} x={x} y={y + 4} textAnchor={anchor} className="radar-label">
            {l}
          </text>
        )
      })}
    </svg>
  )
}

export function Sparkline({
  values,
  color,
  width = 120,
  height = 34,
  fill = true,
  id,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
  fill?: boolean
  id: string
}) {
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 3
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / span) * (height - pad * 2)
    return [x, y]
  })
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spark" aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#g-${id})`} />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={color} />
    </svg>
  )
}

export function Histogram({
  buckets,
  color,
  lang,
}: {
  buckets: { score: number; amount: number }[]
  color: string
  lang: 'zh' | 'en'
}) {
  const max = Math.max(...buckets.map((b) => b.amount), 1)
  const n = buckets.length
  return (
    <div className="histogram">
      {buckets.map((b, i) => (
        <div key={i} className="histo-col" title={`${b.score}: ${b.amount}`}>
          <div
            className="histo-bar"
            style={{ height: `${Math.max(3, (b.amount / max) * 100)}%`, background: color, opacity: 0.35 + 0.65 * (i / n) }}
          />
          {i % 2 === 0 && <span className="histo-x">{b.score}</span>}
        </div>
      ))}
      <span className="histo-caption">{lang === 'zh' ? '分數（每格 10 分）' : 'score (10-pt bins)'}</span>
    </div>
  )
}

export function ContributionBars({
  items,
  baseline,
  total,
  lang,
}: {
  items: { key: string; label: string; points: number }[]
  baseline: number
  total: number
  lang: 'zh' | 'en'
}) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.points)), 1)
  return (
    <div className="contrib">
      <div className="contrib-baseline">
        <span>{lang === 'zh' ? '基準線' : 'Baseline'}</span>
        <strong>{baseline}</strong>
      </div>
      {items.map((it) => (
        <div className="contrib-row" key={it.key}>
          <span className="contrib-label">{it.label}</span>
          <div className="contrib-track">
            <div className="contrib-zero" />
            <div
              className={`contrib-fill ${it.points >= 0 ? 'pos' : 'neg'}`}
              style={
                {
                  width: `${(Math.abs(it.points) / maxAbs) * 48}%`,
                  ...(it.points >= 0 ? { left: '50%' } : { right: '50%' }),
                } as CSSProperties
              }
            />
          </div>
          <span className={`contrib-val ${it.points >= 0 ? 'pos' : 'neg'}`}>
            {it.points >= 0 ? '+' : ''}
            {it.points.toFixed(1)}
          </span>
        </div>
      ))}
      <div className="contrib-total">
        <span>{lang === 'zh' ? '= 破圈指數' : '= Breakout Index'}</span>
        <strong>{total.toFixed(1)}</strong>
      </div>
    </div>
  )
}

export function MiniBars({ values, color }: { values: number[]; color: string }) {
  return (
    <div className="minibars">
      {values.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(8, v)}%`, background: color, opacity: 0.35 + (i / values.length) * 0.65 }} />
      ))}
    </div>
  )
}

export function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="chip" style={color ? { color, borderColor: color + '55', background: color + '12' } : undefined}>
      {children}
    </span>
  )
}
