# Interface tuner

A DSH bundle with one left-sidebar entry. It opens a page in the main column that
adjusts reading comfort through the public client services:

- `ctx.theme.setFontSize` for the text, code, and terminal font roles,
- `ctx.theme.overrideTokens` for four palette presets,
- `ctx.layout.closeRightbar` and `ctx.layout.selectPanel` for the right panel.

Files: `client.js` (browser half), `index.js` (no-op host half), `cordis.patch.yml`
(one inserted row), `locale/*.json` (display metadata), `icon.svg`, `docs/DETAIL.md`.
