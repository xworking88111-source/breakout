import { useMemo, useState } from 'react'
import type { Dataset, Lang, Medium, Work } from '../types'
import type { TKey } from '../i18n'
import { WorkCard, Poster } from '../components/WorkCard'
import { Sparkline } from '../components/Charts'
import {
  bandLabelKey,
  bandOf,
  mediumColor,
  mediumName,
  scoreColor,
  titleOf,
  fmtDate,
  epLabel,
} from '../lib/format'
import { recommendWorks, similarWorks } from '../lib/recommend'
import type { Duration, Mood } from '../lib/recommend'

type Props = {
  data: Dataset
  works: Work[]
  lang: Lang
  t: (k: TKey) => string
  onOpen: (id: string) => void
  onCharts: (m?: Medium) => void
  onMethod: () => void
}

const MEDIA: Medium[] = ['shortdrama', 'anime', 'novel', 'film']
const MOODS: { key: Mood; label: string }[] = [
  { key: 'satisfy', label: 'home.mood.satisfy' },
  { key: 'cry', label: 'home.mood.cry' },
  { key: 'think', label: 'home.mood.think' },
  { key: 'relax', label: 'home.mood.relax' },
  { key: 'date', label: 'home.mood.date' },
]
const DURATIONS: { key: Duration; label: string }[] = [
  { key: '10', label: 'home.mood.d10' },
  { key: '30', label: 'home.mood.d30' },
  { key: '120', label: 'home.mood.d120' },
]

export function Home({ data, works, lang, t, onOpen, onCharts, onMethod }: Props) {
  const [mood, setMood] = useState<Mood>('satisfy')
  const [duration, setDuration] = useState<Duration>('10')

  const spotlight = useMemo(
    () =>
      MEDIA.map((m) => ({
        medium: m,
        work: works.filter((w) => w.medium === m).sort((a, b) => b.hitScore - a.hitScore)[0],
      })).filter((x): x is { medium: Medium; work: Work } => Boolean(x.work)),
    [works],
  )
  const hot = useMemo(
    () =>
      works
        .filter((w) => w.hitScore >= 64 && w.dims.reach >= 55)
        .sort((a, b) => b.dims.momentum - a.dims.momentum)
        .slice(0, 6),
    [works],
  )
  const top = useMemo(() => works.slice(0, 10), [works])
  const picks = useMemo(() => recommendWorks(works, mood, duration), [works, mood, duration])
  const related = useMemo(() => (picks[0] ? similarWorks(works, picks[0], 2) : []), [works, picks])

  const sourceCount = useMemo(() => {
    const s = new Set<string>()
    works.forEach((w) => w.provenance.sources.forEach((x) => s.add(x.url ?? x.name)))
    return s.size
  }, [works])

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="kicker">
            <i className="pulse" /> {t('home.kicker')} · v0.1
          </span>
          <h1>
            {t('home.title.a')}
            <br />
            <span className="grad">{t('home.title.b')}</span>
          </h1>
          <p className="hero-sub">{t('home.sub')}</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => onCharts()}>
              {t('home.cta.charts')} →
            </button>
            <button className="btn btn-ghost" onClick={onMethod}>
              {t('home.cta.method')}
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{works.length}</strong>
              <span>{t('home.kpi.works')}</span>
            </div>
            <div>
              <strong>{sourceCount}</strong>
              <span>{t('home.kpi.sources')}</span>
            </div>
            <div>
              <strong>{data.modelVersion.replace('breakout-', 'v')}</strong>
              <span>{t('home.kpi.model')}</span>
            </div>
          </div>
          <p className="hero-updated">
            {t('home.updated')} {fmtDate(data.snapshotDate, lang)} · 08:00 (UTC+8)
          </p>
        </div>

        <div className="hero-panel">
          <div className="panel-head">
            <span>{t('home.hot')}</span>
            <span className="panel-live">
              <i className="pulse" /> LIVE
            </span>
          </div>
          <p className="panel-sub">{t('home.hot.sub')}</p>
          <div className="panel-list">
            {hot.slice(0, 4).map((w, i) => (
              <button key={w.id} className="panel-row" onClick={() => onOpen(w.id)}>
                <span className="panel-rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="panel-main">
                  <span className="panel-title">{titleOf(w, lang)}</span>
                  <span className="panel-meta">
                    {mediumName(w.medium, lang)} · {w.year}
                  </span>
                </span>
                <span className="panel-spark">
                  {w.heatCurve ? (
                    <Sparkline id={`h-${w.id}`} values={w.heatCurve} color={mediumColor(w.medium)} width={68} height={26} fill={false} />
                  ) : (
                    <span className="panel-mom" style={{ color: mediumColor(w.medium) }}>
                      {Math.round(w.dims.momentum)}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <button className="panel-more" onClick={() => onCharts()}>
            {t('charts.view.table')} →
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>{t('home.spotlight')}</h2>
            <p>{t('home.spotlight.sub')}</p>
          </div>
          <button className="link" onClick={() => onCharts()}>
            {t('common.more')} →
          </button>
        </div>
        <div className="spot-grid">
          {spotlight.map(({ work, medium }) => (
            <button key={work.id} className="spot" onClick={() => onOpen(work.id)} style={{ ['--m' as string]: mediumColor(medium) }}>
              <Poster work={work} size="lg" />
              <div className="spot-body">
                <div className="spot-top">
                  <span className="mchip" style={{ color: mediumColor(medium), borderColor: mediumColor(medium) + '55' }}>
                    {mediumName(medium, lang)}
                  </span>
                  <span className="spot-band" style={{ color: scoreColor(work.hitScore) }}>
                    {t(bandLabelKey(bandOf(work.hitScore)))}
                  </span>
                </div>
                <h3>{titleOf(work, lang)}</h3>
                <p className="spot-meta">
                  {work.year}
                  {work.platform ? ` · ${work.platform}` : ''}
                </p>
                <p className="spot-reason">
                  <span>{t('home.spotlight.reason')}</span>
                  {work.drivers[0] ? (lang === 'zh' ? work.drivers[0].text.zh : work.drivers[0].text.en) : work.synopsis[lang]}
                </p>
                <div className="spot-score">
                  <span style={{ color: scoreColor(work.hitScore) }}>{work.hitScore.toFixed(1)}</span>
                  <span className="spot-score-label">{t('work.score')}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="section mood-section">
        <div className="section-head">
          <div>
            <h2>{t('home.mood')}</h2>
            <p>{t('home.mood.sub')}</p>
          </div>
        </div>
        <div className="mood-box">
          <div className="mood-controls">
            <div className="mood-group">
              {MOODS.map((m) => (
                <button key={m.key} className={`pill ${mood === m.key ? 'on' : ''}`} onClick={() => setMood(m.key)}>
                  {t(m.label as TKey)}
                </button>
              ))}
            </div>
            <div className="mood-group">
              <span className="mood-label">{t('home.mood.duration')}</span>
              {DURATIONS.map((d) => (
                <button key={d.key} className={`pill pill-sm ${duration === d.key ? 'on' : ''}`} onClick={() => setDuration(d.key)}>
                  {t(d.label as TKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="mood-results">
            {picks.length === 0 && <p className="muted">{t('home.mood.empty')}</p>}
            {picks.map((w, i) => (
              <button key={w.id} className="pick" onClick={() => onOpen(w.id)} style={{ ['--m' as string]: mediumColor(w.medium) }}>
                <span className="pick-rank">{i + 1}</span>
                <span className="pick-main">
                  <span className="pick-title">{titleOf(w, lang)}</span>
                  <span className="pick-meta">
                    {mediumName(w.medium, lang)} · {w.year}
                    {epLabel(w, lang) ? ` · ${epLabel(w, lang)}` : ''}
                  </span>
                </span>
                <span className="pick-score" style={{ color: scoreColor(w.hitScore) }}>
                  {w.hitScore.toFixed(1)}
                </span>
              </button>
            ))}
          </div>
          {related.length > 0 && (
            <p className="mood-related">
              {lang === 'zh' ? '看過這部的人也看：' : 'Also considered: '}
              {related.map((r, i) => (
                <button key={r.id} className="inline-link" onClick={() => onOpen(r.id)}>
                  {titleOf(r, lang)}
                  {i < related.length - 1 ? '、' : ''}
                </button>
              ))}
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>{t('home.hot')}</h2>
            <p>{t('home.hot.sub')}</p>
          </div>
          <button className="link" onClick={() => onCharts()}>
            {t('common.more')} →
          </button>
        </div>
        <div className="hot-grid">
          {hot.map((w, i) => (
            <WorkCard key={w.id} work={w} lang={lang} t={t} onOpen={onOpen} variant="row" rank={i + 1} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>{t('home.top')}</h2>
            <p>{t('home.top.sub')}</p>
          </div>
          <button className="link" onClick={() => onCharts()}>
            {t('common.more')} →
          </button>
        </div>
        <div className="rank-table">
          <div className="rt-head">
            <span>{t('charts.table.rank')}</span>
            <span>{t('charts.table.work')}</span>
            <span>{t('charts.table.medium')}</span>
            <span>{t('charts.table.score')}</span>
            <span>{t('charts.table.confidence')}</span>
            <span />
          </div>
          {top.map((w, i) => (
            <button key={w.id} className="rt-row" onClick={() => onOpen(w.id)}>
              <span className="rt-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="rt-title">
                <span>{titleOf(w, lang)}</span>
                <em>{w.year}</em>
              </span>
              <span className="rt-medium" style={{ color: mediumColor(w.medium) }}>
                {mediumName(w.medium, lang)}
              </span>
              <span className="rt-score" style={{ color: scoreColor(w.hitScore) }}>
                {w.hitScore.toFixed(1)}
                <i style={{ width: `${w.hitScore}%`, background: scoreColor(w.hitScore) }} />
              </span>
              <span className={`rt-conf conf-${w.confidence}`}>{t(`confidence.${w.confidence}` as TKey)}</span>
              <span className="rt-arrow">→</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>{t('home.medium.title')}</h2>
            <p>{t('home.medium.sub')}</p>
          </div>
        </div>
        <div className="medium-grid">
          {MEDIA.map((m) => {
            const list = works.filter((w) => w.medium === m)
            const best = list.sort((a, b) => b.hitScore - a.hitScore)[0]
            return (
              <button key={m} className="med-tile" onClick={() => onCharts(m)} style={{ ['--m' as string]: mediumColor(m) }}>
                <span className="med-name">{mediumName(m, lang)}</span>
                <span className="med-count">{t('home.medium.count').replace('{n}', String(list.length))}</span>
                <span className="med-best">{best ? titleOf(best, lang) : '—'}</span>
                <span className="med-arrow">→</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
