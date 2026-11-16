import type { Dataset, Lang } from '../types'
import type { TKey } from '../i18n'
import { DIM_ORDER, dimName, fmtDate, mediumName } from '../lib/format'
import type { Medium } from '../types'

const MEDIA: Medium[] = ['shortdrama', 'anime', 'novel', 'film']

export function Methodology({ data, lang, t }: { data: Dataset; lang: Lang; t: (k: TKey) => string }) {
  const sources = new Map<string, string>()
  data.works.forEach((w) => w.provenance.sources.forEach((s) => sources.set(s.name, s.url ?? '')))

  return (
    <div className="method">
      <header className="page-head">
        <div>
          <h1>{t('method.title')}</h1>
          <p>{t('method.sub')}</p>
        </div>
        <div className="method-meta">
          <div>
            <span>{t('method.version')}</span>
            <strong>{data.modelVersion}</strong>
          </div>
          <div>
            <span>{t('method.snapshot')}</span>
            <strong>{fmtDate(data.snapshotDate, lang)}</strong>
          </div>
        </div>
      </header>

      <section className="block">
        <div className="block-head">
          <h2>{t('method.formula.title')}</h2>
        </div>
        <pre className="formula">{`# 1) 原始指標 → 0–100 絕對刻度（圖示為動漫的實作）
#    Raw metric → absolute 0–100 scale (shown for anime)
reach     = 100·(log10(pop) − 3.3) / (5.9 − 3.3)
quality   = 100·(WR − 58) / (90 − 58)
            WR = (n·S + 500·78) / (n + 500)      # 貝氏收縮 / Bayesian shrinkage，m = 500
buzz      = 100·(log10(n) − 3.4) / (5.9 − 3.4)
momentum  = 100·(log10(trending + 1) − 1.3) / (2.7 − 1.3)
crossover = 100·(excess + 0.5) / (0.8 + 0.5)
            excess = log10(pop) − median(log10(pop) | 同主要類型)

# 2) 加權合成 / Weighted sum
Hit_raw = Σ_d  w[medium][d] × dim_d

# 3) 樣本收縮（僅動漫，n = AniList 評分人數）/ Shrinkage (anime only)
Hit = 50 + (Hit_raw − 50) × max(0.93, n / (n + 600))

# 4) 不確定性 / Uncertainty
CI90 = Hit ± δ ,  δ = clamp(2160 / √n , 0.8, 6)
      編輯估算資料：δ = 5.5，並標記為 estimated`}</pre>
        <p className="prose">{t('method.formula.body')}</p>
        <p className="hint">{t('method.formula.note')}</p>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{t('method.weights')}</h2>
        </div>
        <div className="weights">
          <div className="wt-head">
            <span>{t('charts.table.medium')}</span>
            {DIM_ORDER.map((k) => (
              <span key={k}>{dimName(k, lang)}</span>
            ))}
          </div>
          {MEDIA.map((m) => (
            <div className="wt-row" key={m}>
              <span>{mediumName(m, lang)}</span>
              {DIM_ORDER.map((k) => (
                <span key={k} className="wt-val">
                  {(data.weights[m][k] * 100).toFixed(0)}%
                  <i style={{ width: `${data.weights[m][k] * 100 * 2.2}%` }} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{t('method.dims')}</h2>
          <span className="hint">{t('method.dims.range')}</span>
        </div>
        <div className="dim-cards">
          {DIM_ORDER.map((k) => (
            <div className="dim-card" key={k}>
              <div className="dim-card-head">
                <h3>{dimName(k, lang)}</h3>
                <span className="dim-code">{data.dims[k].en}</span>
              </div>
              <p>{lang === 'zh' ? data.dims[k].descZh : data.dims[k].descEn}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{t('method.limits')}</h2>
        </div>
        <ul className="limit-list">
          <li>{t('method.limits.1')}</li>
          <li>{t('method.limits.2')}</li>
          <li>{t('method.limits.3')}</li>
          <li>{t('method.limits.4')}</li>
        </ul>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{t('method.research')}</h2>
        </div>
        <p className="prose">{t('method.research.body')}</p>
        <ul className="bullets">
          <li>
            <code>{t('method.research.api')}</code>
          </li>
          <li>
            <code>scripts/fetch_anilist.mjs</code> — AniList 抓取腳本（可重跑）
          </li>
          <li>
            <code>scripts/build_dataset.mjs</code> — 計分與合併腳本
          </li>
          <li>CSV 欄位包含 hit_score、ci_low/ci_high、五維、資料狀態、信心、來源</li>
        </ul>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{t('method.changelog')}</h2>
        </div>
        <ul className="bullets">
          <li>{t('method.changelog.1')}</li>
        </ul>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{t('method.sources')}</h2>
          <span className="hint">{sources.size}</span>
        </div>
        <ul className="source-list">
          {[...sources.entries()].slice(0, 40).map(([name, url]) => (
            <li key={name}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer noopener">
                  {name} ↗
                </a>
              ) : (
                name
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
