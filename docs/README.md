# 文檔索引 / Documentation

所有文件皆以繁體中文撰寫，並附英文摘要；核心文件（02、03、06）提供完整雙語內容。
*All documents are written in Traditional Chinese with an English summary; the core documents (02, 03, 06) are fully bilingual.*

| # | 文件 / Document | 中文 | English |
|---|---|---|---|
| 00 | [產品定位與策略](00-產品定位與策略.md) | 客群、JTBD、差異化、如何超越 IMDb、商業模式、風險 | Audience, JTBD, differentiation, how to beat IMDb, business model, risks |
| 01 | [短劇產業與成癮機制](01-短劇產業與成癮機制.md) | 紅果模式、市場規模、成癮四層拆解、劇情 vs 投流、番茄 IP 管線、監管、出海 | Hongguo model, market size, four addiction layers, plot vs. ad spend, Fanqie IP pipeline, regulation, going global |
| 02 | [量化評分機制](02-量化評分機制.md) | 五維模型、完整公式、權重、資料字典、信心區間、反刷分、v0.2 演進、可重現性 | Five-dimension model, full formula, weights, data dictionary, confidence, anti-gaming, v0.2, reproducibility |
| 03 | [數據源與合法性](03-數據源與合法性.md) | 免費資料源清單、綠黃紅燈、API 額度、ETL、第一個月最小資料集 | Free sources, green/yellow/red lists, API limits, ETL, minimum viable dataset |
| 04 | [競品與 UX 資訊架構](04-競品與UX資訊架構.md) | IMDb／豆瓣／Bangumi／DataEye 拆解、簡潔化原則、IA、雙語規範、權威性 | Competitive teardown, simplicity rules, IA, bilingual conventions, authority |
| 05 | [技術架構與路線圖](05-技術架構與路線圖.md) | 技術選型、資料模型、GitHub Pages 部署、成本、12 週路線圖 | Stack, data model, GitHub Pages deployment, cost, 12-week roadmap |
| 06 | [待拍板決策](06-待拍板決策.md) | 需要創辦人／維護者決定的 10 件事與建議預設值 | Ten decisions with recommended defaults |
| 09 | [爆款因子分析](09-爆款因子分析.md) | 自動生成：Top 10% 畫像、類型／平台提升度、收藏差異、方法與限制 | Auto-generated: top-10% profile, genre/platform lift, collection gap, limits |
| 10 | [每日快照與回測](10-快照與回測.md) | 為什麼要每日快照、如何用上月分數預測本月熱度、回測指標 | Daily snapshots, out-of-time backtesting, metrics |
| 11 | [紅果機制與爆款成因](11-紅果機制與爆款成因.md) | 紅果熱度值、收藏 vs 追劇、預約量、賽馬機制、真爆 vs 買爆五信號 | Hongguo heat mechanics, saves vs follows, reservations, horse race, organic vs bought |

## 閱讀順序 / Reading order

1. 先看 **00** 了解產品為什麼存在 / Start with **00** for the product rationale.
2. 再看 **01 + 02** 了解資料與分數怎麼來 / Then **01 + 02** for how data and scores are produced.
3. **03** 決定合法性邊界 / **03** defines the legal boundary.
4. **04 + 05** 決定要做成什麼樣子、怎麼做 / **04 + 05** cover UX and implementation.
5. **06** 是需要你拍板的事 / **06** lists the open decisions.

## 文件撰寫規範 / Writing conventions

- 中文一律使用**繁體中文（台灣用語）**：影片、資料、資訊、影集、最佳化；避免「視頻、信息、數據庫」等簡體用語。
- 每個數字都要有來源或標「未查證」；不同統計口徑要註明。
- 英文摘要放在文件最前面，使用 `> **English summary**` 區塊。
- 修改公式或權重時，必須同步更新 `docs/02`、方法論頁與 `docs/CHANGELOG`。
