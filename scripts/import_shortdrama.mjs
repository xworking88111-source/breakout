#!/usr/bin/env node
/**
 * 匯入研究員產出的 TSV 短劇清單，產生 scripts/seed/shortdrama-bulk.json
 * Import researcher-produced TSV short-drama lists into a seed file.
 *
 * 用法 / Usage: node scripts/import_shortdrama.mjs
 *
 * 輸入 / Input: scripts/seed/incoming/*.tsv
 *   每行 / each line: 年份 \t 劇名 \t 平台／出品方 \t 題材標籤 \t 來源URL \t 可查證事實
 *
 * 規則 / Rules:
 *   - 只收 2023–2026（最近三年為主，含今年）/ only 2023–2026
 *   - 標題去重、去除空白 / de-duplicate titles
 *   - 來源必須是 http(s) URL / source must be an http(s) URL
 *   - 題材留給 build_dataset 轉成標準 genre；無法歸類 → Other
 *   - 從「事實」欄位用正則抽取熱力值／名次／播放量作為估算錨點
 *     Parse heat / rank / plays from the fact column as estimation anchors.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'scripts/seed/incoming')
const OUT = path.join(ROOT, 'scripts/seed/shortdrama-bulk.json')

const allowedYear = (y) => y >= 2023 && y <= 2026
const normTitle = (t) => t.toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】]/g, '')

function parseAnchors(fact) {
  const a = {}
  // 熱力值 1234.5 萬 / heat 1234
  const heat = fact.match(/(?:熱力值|热度值|熱度值)[^\d]{0,4}([\d.]+)\s*(萬|万|億|亿)?/)
  if (heat) {
    let v = Number(heat[1])
    if (heat[2] === '億' || heat[2] === '亿') v *= 10000
    if (Number.isFinite(v) && v > 0) a.heatValue = v
  }
  // 播放 12.3 億 / 播放量 3.4 亿
  const plays = fact.match(/(?:播放|觀看|观看)[^\d]{0,6}([\d.]+)\s*(億|亿)/)
  if (plays) {
    const v = Number(plays[1]) * 1e8
    if (Number.isFinite(v) && v > 0) a.plays = v
  }
  // 第 37 名
  const rank = fact.match(/第\s*(\d{1,3})\s*名/)
  if (rank) {
    const r = Number(rank[1])
    if (r >= 1 && r <= 200) {
      // 月榜／週榜名次不能當年度名次用 / monthly or weekly ranks are weaker signals
      // 只有明確「年度」才當年度名次，其餘（含 3 月熱力榜）一律視為月榜
      // Only explicit annual ranks count as annual; everything else is a monthly signal.
      if (/年度|年榜/.test(fact)) a.dataeyeRank = r
      else a.monthlyRank = r
    }
  }
  // 分賬 500 萬 / 分账破 1000 萬
  const rev = fact.match(/(?:分賬|分账)[^\d]{0,6}([\d.]+)\s*(萬|万)/)
  if (rev) {
    const v = Number(rev[1])
    if (Number.isFinite(v) && v > 0) a.boxOfficeWan = v
  }
  return a
}

const files = (await fs.readdir(DIR).catch(() => [])).filter((f) => f.endsWith('.tsv') && !f.startsWith('._'))
if (!files.length) {
  console.error('✋ scripts/seed/incoming/ 沒有 .tsv 檔案')
  process.exit(1)
}

const seen = new Set()
const items = []
let skipped = 0
const byYear = {}
const genreCount = {}

for (const file of files) {
  const raw = await fs.readFile(path.join(DIR, file), 'utf8')
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 5) {
      skipped++
      continue
    }
    const [yearS, titleS, platformS, genresS, urlS, factS] = cols.map((c) => (c ?? '').trim())
    const year = Number(yearS)
    const title = titleS.replace(/[《》]/g, '').trim()
    if (!allowedYear(year) || !title) {
      skipped++
      continue
    }
    if (!/^https?:\/\//.test(urlS)) {
      skipped++
      continue
    }
    const key = normTitle(title)
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)

    const tags = genresS
      .split(/[,，、/]/)
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 3)
    const genres = tags.length ? tags : ['其他']
    genres.forEach((g) => (genreCount[g] = (genreCount[g] ?? 0) + 1))

    const anchors = parseAnchors(factS)
    const item = {
      id: `sdb-${year}-${String(items.length + 1).padStart(4, '0')}`,
      title: { zh: title, en: title },
      year,
      region: /ReelShort|DramaBox|Kuku|My Drama|ShortMax|GoodShort|NetShort|PineDrama/i.test(platformS) ? 'US' : 'CN',
      platform: platformS || '未查證',
      tags: tags.length ? tags.map((t) => ({ zh: t, en: t })) : [{ zh: '其他', en: 'Other' }],
      estimate: anchors,
      anchorNote: factS || '未查證',
      provenance: {
        status: 'estimated',
        sources: [
          {
            name: file.replace('.tsv', '') + ' 清單',
            url: urlS,
            note: factS || '研究者公開來源',
          },
        ],
      },
    }
    items.push(item)
    byYear[year] = (byYear[year] ?? 0) + 1
  }
}

const doc = {
  dataset: 'shortdrama-bulk',
  note: '由 scripts/import_shortdrama.mjs 從 incoming TSV 匯入；2023–2026 題材廣度清單，分數由 anchors 依 docs/02 SOP 計算。',
  items,
}
await fs.writeFile(OUT, JSON.stringify(doc), 'utf8')

console.log(`✅ imported ${items.length} short dramas from ${files.length} files → scripts/seed/shortdrama-bulk.json`)
console.log('   by year:', byYear)
console.log('   skipped lines:', skipped)
console.log('   top genres:', Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([g, n]) => `${g}:${n}`).join(', '))
