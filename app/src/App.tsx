import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Dataset, Lang, Medium, Work } from './types'
import { zh, en, type TKey } from './i18n'
import { Home } from './views/Home'
import { Rankings, type Filters, type SortKey } from './views/Rankings'
import { WorkDetail } from './views/WorkDetail'
import { Compare } from './views/Compare'
import { Boards } from './views/Boards'
import { Methodology } from './views/Methodology'

type Route =
  | { view: 'home' }
  | { view: 'charts'; filters: Filters }
  | { view: 'work'; id: string }
  | { view: 'compare'; ids: string[] }
  | { view: 'boards' }
  | { view: 'board'; medium: Medium; region: string }
  | { view: 'method' }

const MEDIA_SET: Medium[] = ['shortdrama', 'anime', 'novel', 'film']

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, query] = raw.split('?')
  const qs = new URLSearchParams(query ?? '')
  if (path.startsWith('/work/')) return { view: 'work', id: decodeURIComponent(path.slice(6)) }
  if (path.startsWith('/compare')) {
    const ids = (qs.get('ids') ?? '').split(',').filter(Boolean)
    return { view: 'compare', ids }
  }
  if (path.startsWith('/boards/')) {
    const [, , medium, region] = path.split('/')
    if (MEDIA_SET.includes(medium as Medium) && region) {
      return { view: 'board', medium: medium as Medium, region: decodeURIComponent(region) }
    }
    return { view: 'boards' }
  }
  if (path.startsWith('/boards')) return { view: 'boards' }
  if (path.startsWith('/method')) return { view: 'method' }
  if (path.startsWith('/charts')) {
    const medium = qs.get('medium')
    return {
      view: 'charts',
      filters: {
        medium: medium && MEDIA_SET.includes(medium as Medium) ? (medium as Medium) : undefined,
        region: qs.get('region') ?? undefined,
        genre: qs.get('genre') ?? undefined,
        q: qs.get('q') ?? undefined,
        sort: ((qs.get('sort') as SortKey) || 'score') as SortKey,
        view: qs.get('view') === 'cards' ? 'cards' : 'table',
      },
    }
  }
  return { view: 'home' }
}

function chartsHash(f: Filters): string {
  const qs = new URLSearchParams()
  if (f.medium) qs.set('medium', f.medium)
  if (f.region) qs.set('region', f.region)
  if (f.genre) qs.set('genre', f.genre)
  if (f.q) qs.set('q', f.q)
  if (f.sort !== 'score') qs.set('sort', f.sort)
  if (f.view === 'cards') qs.set('view', 'cards')
  const s = qs.toString()
  return `/charts${s ? `?${s}` : ''}`
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('breakout-lang') : null
    return saved === 'en' ? 'en' : 'zh'
  })
  const [route, setRoute] = useState<Route>(() => parseHash())
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [data, setData] = useState<Dataset | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const t = useMemo(() => {
    const dict = lang === 'zh' ? zh : en
    return (k: TKey) => dict[k] ?? k
  }, [lang])

  // 資料以獨立 JSON 載入，避免 1000+ 部作品被打包進 JS bundle。
  // The dataset is fetched as a separate JSON file so 1000+ works stay out of the JS bundle.
  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/works.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: Dataset) => {
        if (!cancelled) setData(d)
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
    localStorage.setItem('breakout-lang', lang)
  }, [lang])

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash())
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.location.hash = '/'
  }, [])

  const navigate = (hash: string) => {
    setMenuOpen(false)
    if (window.location.hash === `#${hash}`) {
      setRoute(parseHash())
      window.scrollTo({ top: 0 })
    } else {
      window.location.hash = hash
    }
  }

  const works = (data?.works ?? []) as Work[]
  const onOpen = (id: string) => navigate(`/work/${encodeURIComponent(id)}`)
  const onCharts = (m?: Medium) => navigate(chartsHash({ sort: 'score', view: 'table', medium: m }))
  const onMethod = () => navigate('/method')

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    navigate(chartsHash({ q: query.trim() || undefined, sort: 'score', view: 'table' }))
  }

  const navItems: { label: TKey; active: boolean; onClick: () => void }[] = [
    { label: 'nav.home', active: route.view === 'home', onClick: () => navigate('/') },
    { label: 'nav.charts', active: route.view === 'charts', onClick: () => onCharts() },
    { label: 'nav.boards', active: route.view === 'boards' || route.view === 'board', onClick: () => navigate('/boards') },
    { label: 'nav.compare', active: route.view === 'compare', onClick: () => navigate('/compare') },
    { label: 'nav.method', active: route.view === 'method', onClick: onMethod },
  ]

  const compareIds = route.view === 'compare' ? route.ids : []

  if (!data) {
    return (
      <div className="app loading-app">
        <div className="loading-box">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M4 18 L9 9 L13 14 L20 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="20" cy="4" r="2" fill="currentColor" />
            </svg>
          </span>
          <p>{loadError ? `資料載入失敗 / Failed to load data: ${loadError}` : '載入資料中… / Loading dataset…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden />
      <header className="header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate('/')} aria-label="Breakout home">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M4 18 L9 9 L13 14 L20 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="4" r="2" fill="currentColor" />
              </svg>
            </span>
            <span className="brand-text">
              <span className="brand-name">Breakout</span>
              <span className="brand-cn">{t('brand.cn')}</span>
            </span>
          </button>

          <nav className={`nav ${menuOpen ? 'open' : ''}`}>
            {navItems.map((n) => (
              <button key={n.label} className={`nav-btn ${n.active ? 'on' : ''}`} onClick={n.onClick}>
                {t(n.label)}
              </button>
            ))}
          </nav>

          <div className="header-right">
            <form className="search" onSubmit={submitSearch}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('nav.search')} aria-label={t('nav.search')} />
            </form>
            <button className="lang-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
              {lang === 'zh' ? 'EN' : '繁中'}
            </button>
            <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('nav.menu')}>
              ☰
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {route.view === 'home' && (
          <Home data={data} works={works} lang={lang} t={t} onOpen={onOpen} onCharts={onCharts} onBoards={() => navigate('/boards')} onMethod={onMethod} />
        )}
        {route.view === 'charts' && (
          <Rankings
            data={data}
            works={works}
            lang={lang}
            t={t}
            filters={route.filters}
            onChange={(f) => navigate(chartsHash(f))}
            onOpen={onOpen}
          />
        )}
        {route.view === 'boards' && (
          <Boards data={data} works={works} lang={lang} t={t} onOpen={onOpen} selected={null} onSelect={(s) => navigate(s ? `/boards/${s.medium}/${s.region}` : '/boards')} />
        )}
        {route.view === 'board' && (
          <Boards
            data={data}
            works={works}
            lang={lang}
            t={t}
            onOpen={onOpen}
            selected={{ medium: route.medium, region: route.region }}
            onSelect={(s) => navigate(s ? `/boards/${s.medium}/${s.region}` : '/boards')}
          />
        )}
        {route.view === 'work' &&
          (() => {
            const w = works.find((x) => x.id === route.id)
            if (!w) return <p className="empty">404</p>
            return (
              <WorkDetail
                work={w}
                works={works}
                lang={lang}
                t={t}
                onOpen={onOpen}
                onBack={() => window.history.back()}
                onCompare={(id) => navigate(`/compare?ids=${encodeURIComponent(id)}`)}
              />
            )
          })()}
        {route.view === 'compare' && (
          <Compare
            works={works}
            ids={compareIds}
            lang={lang}
            t={t}
            onSelect={(ids) => navigate(`/compare?ids=${ids.map(encodeURIComponent).join(',')}`)}
            onOpen={onOpen}
          />
        )}
        {route.view === 'method' && <Methodology data={data} lang={lang} t={t} />}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="brand-name">Breakout {t('brand.cn')}</span>
            <span className="footer-tag">{t('brand.tagline')}</span>
            <span className="footer-note">
              {t('home.updated')} {data.snapshotDate} · {data.modelVersion} · {data.works.length} titles
            </span>
          </div>
          <div className="footer-links">
            <button onClick={() => navigate('/charts')}>{t('nav.charts')}</button>
            <button onClick={() => navigate('/boards')}>{t('nav.boards')}</button>
            <button onClick={onMethod}>{t('nav.method')}</button>
            <button onClick={() => navigate('/compare')}>{t('nav.compare')}</button>
          </div>
          <p className="footer-disclaimer">{t('footer.disclaimer')}</p>
        </div>
      </footer>
    </div>
  )
}
