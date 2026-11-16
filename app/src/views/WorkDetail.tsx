import { useMemo, useState } from 'react'
import type { Lang, Work } from '../types'
import type { TKey } from '../i18n'
import { ContributionBars, Histogram, Radar, Sparkline } from '../components/Charts'
import { Poster, StatusBadge, WorkCard } from '../components/WorkCard'
import {
  bandLabelKey,
  bandOf,
  dimName,
  epLabel,
  fmtDate,
  mediumColor,
  mediumName,
  runtimeLabel,
  scoreColor,
  titleOf,
  altTitleOf,
} from '../lib/format'
import { DIM_ORDER } from '../lib/format'
import { genreLabel, regionLabel, tagLabel } from '../lib/labels'
import { citationOf, similarWorks } from '../lib/recommend'

export function WorkDetail({
  work,
  works,
  lang,
  t,
  onOpen,
  onBack,
  onCompare,
}: {
  work: Work
  works: Work[]
  lang: Lang
  t: (k: TKey) => string
  onOpen: (id: string) => void
  onBack: () => void
  onCompare: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const color = mediumColor(work.medium)
  const band = bandOf(work.hitScore)
  const labels = DIM_ORDER.map((k) => dimName(k, lang))

  const ranks = useMemo(() => {
    const overall = works.findIndex((w) => w.id === work.id) + 1
    const same = works.filter((w) => w.medium === work.medium).findIndex((w) => w.id === work.id) + 1
    return { overall, same }
  }, [works, work])

  const similar = useMemo(() => similarWorks(works, work, 3), [works, work])
  const contribs = work.contributions.map((c) => ({ key: c.key, label: dimName(c.key, lang), points: c.points }))

  const copyCite = async () => {
    try {
      await navigator.clipboard.writeText(citationOf(work, lang))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const facts: { label: TKey; value: string }[] = []
  if (work.platform) facts.push({ label: 'work.facts.platform', value: work.platform })
  facts.push({ label: 'work.facts.year', value: String(work.year) })
  facts.push({ label: 'work.facts.region', value: regionLabel(work.region, lang) })
  const eps = epLabel(work, lang)
  if (eps) facts.push({ label: 'work.facts.episodes', value: eps })
  const rt = runtimeLabel(work, lang)
  if (rt) facts.push({ label: 'work.facts.duration', value: rt })
  if (work.genres.length) facts.push({ label: 'work.facts.genres', value: work.genres.map((g) => genreLabel(g, lang)).join('、') })

  return (
    <article className="detail">
      <button className="back" onClick={onBack}>
        ← {t('work.back')}
      </button>

      <header className="detail-hero">
        <div className="detail-copy">
          <div className="detail-badges">
            <span className="mchip" style={{ color, borderColor: color + '55', background: color + '14' }}>
              {mediumName(work.medium, lang)}
            </span>
            <StatusBadge status={work.provenance.status} confidence={work.confidence} t={t} />
            <span className="rank-chip">
              {t('work.sameMediumRank').replace('{n}', String(ranks.same))} · {t('work.rank').replace('{n}', String(ranks.overall))}
            </span>
          </div>
          <h1>{titleOf(work, lang)}</h1>
          {altTitleOf(work, lang) && <p className="detail-alt">{altTitleOf(work, lang)}</p>}
          <p className="detail-synopsis">{work.synopsis[lang]}</p>

          <div className="score-block">
            <div className="score-main">
              <span className="score-num" style={{ color: scoreColor(work.hitScore) }}>
                {work.hitScore.toFixed(1)}
              </span>
              <div className="score-side">
                <span className="score-label">{t('work.score')}</span>
                <span className="score-band" style={{ color: scoreColor(work.hitScore) }}>
                  {t(bandLabelKey(band))}
                </span>
                <span className="score-ci">
                  {t('work.ci')} {work.ci[0]}–{work.ci[1]} · {t(`confidence.${work.confidence}` as TKey)}
                </span>
              </div>
            </div>
            <div className="score-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => onCompare(work.id)}>
                ⇄ {t('nav.compare')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={copyCite}>
                {copied ? `✓ ${t('work.cite.copied')}` : `❐ ${t('work.cite')}`}
              </button>
            </div>
          </div>

          <div className="taglist">
            {work.tags.slice(0, 6).map((tag) => (
              <span key={tag.zh} className="tag">
                {lang === 'zh' ? (tag.zh !== tag.en ? tag.zh : tagLabel(tag.en, 'zh')) : tag.en}
              </span>
            ))}
          </div>

          <div className="hero-facts">
            {facts.map((f) => (
              <span key={f.label} className="hero-fact">
                <em>{t(f.label)}</em>
                {f.value}
              </span>
            ))}
          </div>

          <div className="dimrow">
            {DIM_ORDER.map((k) => (
              <div className="dimcell" key={k}>
                <span>{dimName(k, lang)}</span>
                <strong style={{ color: work.dims[k] >= 60 ? color : 'var(--muted)' }}>{Math.round(work.dims[k])}</strong>
                <i>
                  <b style={{ width: `${work.dims[k]}%`, background: color }} />
                </i>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-visual">
          <Poster work={work} size="lg" />
          <div className="radar-card">
            <Radar series={[{ values: DIM_ORDER.map((k) => work.dims[k]), color }]} labels={labels} size={286} lang={lang} />
            <p className="radar-note">{t('work.radar.note')}</p>
          </div>
        </div>
      </header>

      <section className="detail-grid">
        <div className="block">
          <div className="block-head">
            <h2>{t('work.why')}</h2>
            <span className="hint">{t('work.why.formula')}</span>
          </div>
          <ContributionBars items={contribs} baseline={50} total={work.hitScore} lang={lang} />
          <p className="block-note">{t('work.why.sub')}</p>

          {work.drivers.length > 0 && (
            <div className="drivers">
              <div className="drivers-head">
                <h3>{t('work.drivers')}</h3>
                <span className="hint">{t('work.drivers.note')}</span>
              </div>
              <ul>
                {work.drivers.map((d, i) => (
                  <li key={i}>
                    <span>{lang === 'zh' ? d.text.zh : d.text.en}</span>
                    {d.source && (
                      <a href={d.source.url} target="_blank" rel="noreferrer noopener">
                        {d.source.name} ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="block">
          <div className="block-head">
            <h2>{work.scoreDistribution ? t('work.distribution') : t('work.series')}</h2>
            <span className="hint">{work.scoreDistribution ? t('work.distribution.note') : t('work.series.note')}</span>
          </div>
          {work.scoreDistribution ? (
            <Histogram buckets={work.scoreDistribution} color={color} lang={lang} />
          ) : work.heatCurve ? (
            <div className="bigspark">
              <Sparkline id={`d-${work.id}`} values={work.heatCurve} color={color} width={420} height={140} />
              <div className="bigspark-axis">
                <span>{lang === 'zh' ? '上線' : 'launch'}</span>
                <span>{lang === 'zh' ? '第 6 週' : 'week 6'}</span>
                <span>{lang === 'zh' ? '第 12 週' : 'week 12'}</span>
              </div>
            </div>
          ) : (
            <p className="muted">—</p>
          )}

        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{t('work.provenance')}</h2>
          <span className={`badge badge-${work.provenance.status}`}>{t(`status.${work.provenance.status}` as TKey)}</span>
        </div>
        <p className="provenance-note">{work.provenance.note?.[lang]}</p>
        <ul className="sources">
          {work.provenance.sources.map((s, i) => (
            <li key={i}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  {s.name} ↗
                </a>
              ) : (
                <span>{s.name}</span>
              )}
              {s.fetchedAt && <em> · {fmtDate(s.fetchedAt, lang)}</em>}
              {s.note && <em> · {s.note}</em>}
            </li>
          ))}
        </ul>
      </section>

      {similar.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>{t('work.similar')}</h2>
              <p>{t('work.similar.sub')}</p>
            </div>
          </div>
          <div className="grid-3">
            {similar.map((w) => (
              <WorkCard key={w.id} work={w} lang={lang} t={t} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
