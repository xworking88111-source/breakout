#!/usr/bin/env node
/**
 * 從 Bangumi（bgm.tv）公開 API 抓取小說與電影資料。
 * Fetch novels and films from the public Bangumi API.
 *
 * 用法 / Usage: node scripts/fetch_bangumi.mjs
 *
 * 資料來源 / Source: https://api.bgm.tv/v0  (public, read-only, no key; requires User-Agent)
 * 授權 / Licence: Bangumi 使用者貢獻內容（CC BY-SA 精神）；本站只取事實欄位（名稱、年份、評分、收藏數），
 *   不轉載簡介全文。正式上線前請確認條款。
 *   Bangumi content is user-contributed; we store factual fields only (title, date, rating, collections),
 *   not full summaries. Verify terms before production.
 *
 * 策略 / Strategy: 搜尋 API 每次最多回 10 筆，因此用「標籤批次」累積候選再按 platform 過濾。
 *   The search API returns at most 10 rows per query, so we batch by tag and filter by platform.
 */

import fs from 'node:fs/promises'

const API = 'https://api.bgm.tv/v0/search/subjects'
const SNAPSHOT = new Date().toISOString().slice(0, 10)
const UA = 'breakout-index/0.1 (+https://github.com/xworking88111-source/breakout)'
const DELAY_MS = 1200 // 禮貌性延遲 / polite delay

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const NOVEL_TAGS = [
  '小说', '轻小说', '文学', '推理', '奇幻', '恋爱', '科幻', '青春', '日本', '中国',
  '2024', '2023', '2025', '2022', '2021', '2020', '2019', '2018', '日常', '悬疑',
  '历史', '校园', '网络小说', '轻文学', '少女', '冒险', '战争', '治愈', '搞笑', '悬疑推理',
  '美国', '英国', '法国', '韩国', '台湾', '香港',
]
const FILM_TAGS = [
  '电影', '日本', '美国', '中国', '香港', '韩国', '台湾', '法国', '英国',
  '2024', '2023', '2025', '2022', '2021', '2020', '2019', '2018', '科幻', '悬疑',
  '犯罪', '爱情', '剧情', '战争', '历史', '喜剧', '动作', '恐怖', '动画',
  '纪录片', '传记', '音乐', '家庭', '冒险', '奇幻', '运动', '西部', '黑色幽默', '武侠',
]

const REGION_BY_TAG = {
  日本: 'JP', 中国: 'CN', 美国: 'US', 香港: 'HK', 韩国: 'KR', 台湾: 'TW',
  法国: 'FR', 英国: 'GB', 德国: 'DE', 意大利: 'IT', 西班牙: 'ES', 印度: 'IN',
}
const REGION_ZH = {
  JP: '日本', CN: '中國', US: '美國', HK: '香港', KR: '韓國', TW: '台灣',
  FR: '法國', GB: '英國', DE: '德國', IT: '義大利', ES: '西班牙', IN: '印度',
}

async function search(type, tag) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ keyword: '', sort: 'heat', filter: { type: [type], tag: [tag] }, limit: 10 }),
  })
  if (res.status === 429) {
    await sleep(3000)
    return search(type, tag)
  }
  if (!res.ok) {
    console.warn(`  ! ${type}/${tag} HTTP ${res.status}`)
    return []
  }
  const json = await res.json()
  return json.data ?? []
}

function regionOf(subject) {
  const tags = (subject.tags ?? []).map((t) => t.name)
  for (const t of tags) if (REGION_BY_TAG[t]) return REGION_BY_TAG[t]
  const info = subject.infobox ?? []
  const country = info.find((x) => ['国家/地区', '国家', '地区', '製片國家'].includes(x.key))
  const v = String(country?.value ?? '')
  for (const [k, code] of Object.entries(REGION_BY_TAG)) if (v.includes(k)) return code
  return type6Default(subject)
}

function type6Default(subject) {
  const p = subject.platform ?? ''
  if (p.includes('日')) return 'JP'
  if (p.includes('欧美') || p.includes('美')) return 'US'
  if (p.includes('港')) return 'HK'
  if (p.includes('台')) return 'TW'
  if (p.includes('韩')) return 'KR'
  return 'GLOBAL'
}

function yearOf(subject) {
  const y = Number((subject.date ?? '').slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function normalize(subject, medium) {
  const titleZh = subject.name_cn || subject.name
  const titleEn = subject.name
  const tags = (subject.tags ?? []).slice(0, 8).map((t) => t.name)
  const info = Object.fromEntries((subject.infobox ?? []).map((x) => [x.key, x.value]))
  return {
    id: `bgm-${subject.id}`,
    bangumiId: subject.id,
    medium,
    title: { zh: titleZh, en: titleEn },
    date: subject.date ?? null,
    year: yearOf(subject),
    country: regionOf(subject),
    platform: subject.platform ?? null,
    genres: [],
    tags: tags.map((t) => ({ zh: t, en: t })),
    episodes: medium === 'film' ? null : (subject.volumes ?? subject.eps ?? null),
    episodeMinutes: null,
    status: 'FINISHED',
    metrics: {
      score: subject.rating?.score ?? null,
      ratingCount: subject.rating?.total ?? 0,
      rank: subject.rating?.rank ?? null,
      distribution: subject.rating?.count ?? null,
      collect: subject.collection?.collect ?? 0,
      wish: subject.collection?.wish ?? 0,
      doing: subject.collection?.doing ?? 0,
      dropped: subject.collection?.dropped ?? 0,
    },
    provenance: {
      status: 'measured',
      sources: [
        {
          name: `Bangumi 番組計劃（subject ${subject.id}）`,
          url: `https://bgm.tv/subject/${subject.id}`,
          fetchedAt: SNAPSHOT,
          note: '評分、評分人數、收藏數為 Bangumi 公開資料快照',
        },
      ],
    },
  }
}

async function collect(type, tags, medium, platformMatch) {
  const seen = new Map()
  for (const tag of tags) {
    const rows = await search(type, tag)
    for (const s of rows) {
      if (!platformMatch(s.platform ?? '')) continue
      if (!s.rating?.total || s.rating.total < 25) continue
      if (!seen.has(s.id)) seen.set(s.id, normalize(s, medium))
    }
    process.stdout.write(`  ${medium} tag=${tag}: ${seen.size}\n`)
    await sleep(DELAY_MS)
  }
  return [...seen.values()]
}

async function main() {
  const novels = await collect(1, NOVEL_TAGS, 'novel', (p) => p.includes('小说'))
  const films = await collect(6, FILM_TAGS, 'film', (p) => p.includes('电影'))

  const write = async (name, items) => {
    const out = {
      dataset: name,
      source: 'Bangumi API v0 (https://api.bgm.tv/v0)',
      snapshotDate: SNAPSHOT,
      license: 'Bangumi 使用者貢獻資料；僅取事實欄位，不轉載簡介全文 / factual fields only',
      count: items.length,
      items: items.sort((a, b) => b.metrics.collect - a.metrics.collect),
    }
    await fs.writeFile(new URL(`../app/src/data/${name}.json`, import.meta.url), JSON.stringify(out, null, 2), 'utf8')
    console.log(`✅ ${name}: ${items.length}`)
  }

  await write('bangumi-novel', novels)
  await write('bangumi-film', films)
  const byRegion = (arr) => arr.reduce((m, x) => ((m[x.country] = (m[x.country] ?? 0) + 1), m), {})
  console.log('novels by region:', byRegion(novels))
  console.log('films by region:', byRegion(films))
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
