# Traditional Chinese language pack

Adds a `zh-Hant` locale to the DSH client. The client ships only `zh`
(Simplified) and `en` as baseline dictionaries; this bundle registers the
language through `ctx.locale.addLanguage` and re-registers every shipped UI
namespace through `ctx.locale.register(ns, 'zh-Hant', dict)`.

`client.js` is generated: `tools/extract.mjs` collects the dictionaries from the
installed packages' `src/` sources, `tools/build.mjs` converts them with OpenCC
(`twp`) and emits the bundle. Select 繁體中文 in Settings → Language.
