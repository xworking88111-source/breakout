# 貢獻指南 / Contributing

感謝你願意一起把內容數據做得更透明。
*Thanks for helping make content data more transparent.*

---

## 中文

### 可以貢獻什麼

1. **資料勘誤**：票房、播放量、年份、平台、改編關係有誤 → 附公開來源連結。
2. **新增作品**：優先補短劇（最大缺口），其次華語小說、日本動畫、電影。
3. **翻譯**：英文文案、作品英譯名、術語表。
4. **資料源**：新的免費、合規 API 或公開榜單。
5. **程式**：前端元件、圖表、效能、無障礙。

### 新增一筆作品

1. 在 `scripts/seed/{shortdrama|novel|film}.json` 新增物件（格式參考現有項目）。
2. 必填欄位：`id`、`title.zh`、`title.en`、`year`、`region`、`genres`、`tags`、`synopsis.zh`、`synopsis.en`、`dims`、`provenance`。
3. `dims` 五維（0–100）：`reach`、`quality`、`buzz`、`momentum`、`crossover`。請在 PR 說明**你如何推估**（例如「依 2025 DataEye 年度第 2 的熱力值，reach 估 86」）。
4. `provenance.status` 必須是 `estimated`（公開報導推估）或 `measured`（有公開 API／官方統計）；`sources` 至少一筆可點擊連結。
5. 執行 `node scripts/build_dataset.mjs && node scripts/validate_dataset.mjs`，確認通過。

### PR 檢查清單

- [ ] 資料集驗證通過（`node scripts/validate_dataset.mjs`）
- [ ] 型別檢查與建置通過（`cd app && npx tsc --noEmit && npx vite build`）
- [ ] 新增／修改的中文文案為**繁體中文**，且中英文都有
- [ ] 程式碼註解中英雙語（至少新增的部分）
- [ ] 沒有引入付費 API、付費服務或需要金鑰的服務
- [ ] 沒有轉載未授權的榜單全文、封面圖或文章全文

### 資料倫理

- **不造假**：查不到就寫「未查證」，不要編造播放量或票房。
- **標口徑**：同一數字可能有不同統計範圍（全市場／核心市場、App／去重用戶），請註明。
- **不宣稱官方**：本站與任何平台無隸屬關係；不得使用「官方數據」字樣。
- **尊重 robots.txt 與 ToS**：不繞過反爬、不鏡像付費內容。

### 程式風格

- TypeScript strict；不使用 `any`（真的需要時加註解說明）。
- 圖表用原生 SVG，不引入大型圖表庫。
- 樣式集中在 `app/src/styles.css`，使用既有 CSS 變數。
- 註解格式：`// 中文 / English`。

---

## English

### What you can contribute

1. **Data corrections**: box office, play counts, years, platforms or adaptation links — include a public source URL.
2. **New titles**: short dramas first (biggest gap), then Chinese novels, Japanese anime and films.
3. **Translations**: English copy, English titles, glossary.
4. **Data sources**: new free, compliant APIs or public charts.
5. **Code**: components, charts, performance, accessibility.

### Adding a title

1. Add an object to `scripts/seed/{shortdrama|novel|film}.json` (copy an existing entry as a template).
2. Required fields: `id`, `title.zh`, `title.en`, `year`, `region`, `genres`, `tags`, `synopsis.zh`, `synopsis.en`, `dims`, `provenance`.
3. `dims` (0–100): `reach`, `quality`, `buzz`, `momentum`, `crossover`. Explain your estimation method in the PR (e.g. "Reach 86 based on #2 on DataEye's 2025 annual heat chart").
4. `provenance.status` must be `estimated` (from public reporting) or `measured` (public API or official statistics); include at least one clickable source.
5. Run `node scripts/build_dataset.mjs && node scripts/validate_dataset.mjs` and make sure both pass.

### PR checklist

- [ ] Dataset validation passes (`node scripts/validate_dataset.mjs`)
- [ ] Type-check and build pass (`cd app && npx tsc --noEmit && npx vite build`)
- [ ] Chinese copy is **Traditional Chinese** and every string exists in both languages
- [ ] Code comments are bilingual (at least for new code)
- [ ] No paid APIs, paid services or key-required services introduced
- [ ] No unauthorised mirrors of full charts, cover art or article text

### Data ethics

- **Never fabricate**: if a number cannot be verified, write "unverified"; do not invent play counts or box office.
- **State the scope**: the same metric may use different scopes (whole market vs. core market, app users vs. deduplicated users).
- **No official claims**: this project is not affiliated with any platform.
- **Respect robots.txt and ToS**: do not bypass anti-bot measures or mirror paid content.

### Code style

- TypeScript strict; avoid `any` (document it if unavoidable).
- Charts are hand-written SVG; no heavy chart libraries.
- Styles live in `app/src/styles.css` and use existing CSS variables.
- Comment format: `// 中文 / English`.
