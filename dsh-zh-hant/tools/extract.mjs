/**
 * Build-time extractor: collect every client locale namespace and its
 * Simplified Chinese (zh) dictionary from the installed dsh packages, so a
 * Traditional Chinese language pack can re-register the same keys.
 *
 * Reads the shipped `src/` TypeScript sources (the built bundles are minified).
 * Writes /tmp/dsh-zh-pack.json and prints a per-package summary.
 */
import fs from 'node:fs'
import path from 'node:path'

const nm = path.dirname(process.env.DSH_INSTALL_DIR)
const out = {}
const markers = []
const problems = []
const summary = []

/** Slice a JS object literal starting at the `{` index, string/comment aware. */
function sliceObject(text, start) {
  let i = start
  let depth = 0
  let quote = null
  while (i < text.length) {
    const c = text[i]
    if (quote !== null) {
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i += 1; continue }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) return null; continue }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 2; continue }
    if (c === '{') depth += 1
    else if (c === '}') { depth -= 1; if (depth === 0) return text.slice(start, i + 1) }
    i += 1
  }
  return null
}


/** Index of the object literal that initializes `const <name>` (type annotation allowed). */
function objectDefIndex(text, name) {
  const m = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*(?::[^=]+)?=\\s*\\{`).exec(text)
  if (m === null) return -1
  return text.indexOf('{', m.index + m[0].length - 1)
}

/** Slice a JS array literal starting at the `[` index. */
function sliceArray(text, start) {
  let i = start
  let depth = 0
  let quote = null
  while (i < text.length) {
    const c = text[i]
    if (quote !== null) {
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i += 1; continue }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) return null; continue }
    if (c === '[') depth += 1
    else if (c === ']') { depth -= 1; if (depth === 0) return text.slice(start, i + 1) }
    i += 1
  }
  return null
}

/** Identifier values a dictionary literal may reference from its own module. */
function localScope(fileText) {
  const scope = {}
  for (const m of fileText.matchAll(/(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::[^=]+)?=\s*/g)) {
    const name = m[1]
    if (Object.prototype.hasOwnProperty.call(scope, name)) continue
    const at = m.index + m[0].length
    const head = fileText[at]
    let literal = null
    if (head === '{') literal = sliceObject(fileText, at)
    else if (head === '[') literal = sliceArray(fileText, at)
    else {
      const quoted = /^(['"])([^'"]*)\1/.exec(fileText.slice(at, at + 4000))
      if (quoted !== null) literal = quoted[0]
    }
    if (literal === null) continue
    try {
      // eslint-disable-next-line no-new-func
      scope[name] = new Function(`return (${literal})`)()
    } catch { /* skip consts that reference runtime values */ }
  }
  return scope
}

/** Self-referential placeholder for identifiers outside the module scope. */
function unknownProxy() {
  const proxy = new Proxy(function () {}, {
    get: () => proxy,
    apply: () => proxy,
    construct: () => proxy,
  })
  return proxy
}

/** Evaluate a dictionary literal tolerantly: unknown identifiers become placeholders. */
function evalTolerant(lit, fileText) {
  const scope = localScope(fileText)
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (target, key) => (key === Symbol.unscopables ? undefined : (key in target ? target[key] : unknownProxy())),
  })
  try {
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) { return (${lit}) }`)(proxy)
  } catch {
    return null
  }
}

function literalIn(text, name) {
  const m = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*(['"])([^'"]+)\\1`).exec(text)
  return m === null ? null : m[2]
}

/** Parse a dictionary literal, merging `...spread` entries defined in the same file. */
function parseDict(lit, fileText, depth = 0) {
  if (depth > 4) return null
  let text = lit
  const extras = {}
  for (const spread of [...lit.matchAll(/\.\.\.\s*([A-Za-z0-9_$]+)/g)]) {
    const at = objectDefIndex(fileText, spread[1])
    if (at >= 0) {
      const inner = parseDict(sliceObject(fileText, at), fileText, depth + 1)
      if (inner !== null) Object.assign(extras, inner)
    }
    text = text.replace(spread[0], '...{}')
  }
  const parsed = parseLiteral(text) ?? evalTolerant(text, fileText)
  if (parsed === null) return null
  const merged = { ...extras, ...parsed }
  const clean = Object.fromEntries(Object.entries(merged).filter(([, value]) => typeof value === 'string'))
  const dropped = Object.keys(merged).length - Object.keys(clean).length
  if (dropped > 0) markers.push(`${fileText.slice(0, 60)} dropped=${dropped}`)
  return clean
}

function parseLiteral(lit) {
  try {
    // eslint-disable-next-line no-new-func
    const value = new Function(`return (${lit})`)()
    return value !== null && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

/** Resolve one module specifier to an existing file. */
function resolveModule(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch { /* keep looking */ }
  }
  return null
}

/**
 * Find the `zh` dictionary a module exports, following local re-exports.
 * @param file absolute module path.
 * @param seen recursion guard.
 */
function dictFromModule(file, seen = new Set()) {
  if (file === null || seen.has(file)) return null
  seen.add(file)
  const text = fs.readFileSync(file, 'utf8')
  for (const name of ['zh', 'zhCN', 'zhHans']) {
    const at = objectDefIndex(text, name)
    if (at >= 0) {
      const parsed = parseDict(sliceObject(text, at), text)
      if (parsed !== null) return parsed
    }
  }
  // `export { zh } from './x'` / `export { zh as zh } from './x'` / `export * from './x'`
  for (const m of text.matchAll(/export\s*\{[^}]*\bzh\b[^}]*\}\s*from\s*(['"])([^'"]+)\1/g)) {
    const found = dictFromModule(resolveModule(file, m[2]), seen)
    if (found !== null) return found
  }
  for (const m of text.matchAll(/export\s*\*\s*from\s*(['"])([^'"]+)\1/g)) {
    const found = dictFromModule(resolveModule(file, m[2]), seen)
    if (found !== null) return found
  }
  return null
}

function readAll(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) readAll(full, acc)
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

/** Resolve the dictionary named by a registration's object literal. */
function dictFromRegistration(file, text, objectLiteral) {
  const inline = /\bzh\s*:\s*\{/.exec(objectLiteral)
  if (inline !== null) {
    const start = objectLiteral.indexOf('{', inline.index + inline[0].length - 1)
    const parsed = parseDict(sliceObject(objectLiteral, start), objectLiteral)
    if (parsed !== null) return parsed
  }
  const after = objectLiteral.indexOf('}', objectLiteral.indexOf('zh'))
  const head = objectLiteral.slice(0, after + 1)
  const named = /\bzh\s*:\s*([A-Za-z0-9_$]+)/.exec(head)
  const local = named === null ? 'zh' : named[1]
  const sameFile = objectDefIndex(text, local)
  if (sameFile >= 0) {
    const parsed = parseLiteral(sliceObject(text, sameFile))
    if (parsed !== null) return parsed
  }
  // Import of that identifier, possibly aliased, from a relative module.
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g)) {
    const spec = m[1].split(',').map(s => s.trim()).filter(Boolean)
    const hit = spec.find(part => {
      const [orig, alias] = part.split(/\s+as\s+/).map(s => s.trim())
      return (alias ?? orig) === local && orig === 'zh'
    })
    if (hit === undefined) continue
    const target = resolveModule(file, m[3])
    const dict = dictFromModule(target)
    if (dict !== null) return dict
  }
  return null
}

for (const pkg of fs.readdirSync(nm)) {
  if (!pkg.startsWith('dsh')) continue
  const pkgDir = path.join(nm, pkg)
  const src = path.join(pkgDir, 'src')
  if (!fs.existsSync(src)) continue
  const files = readAll(src)
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    if (!text.includes('locale.register(')) continue
    const rel = path.relative(pkgDir, file)
    for (const m of text.matchAll(/locale\.register\(\s*([^,]+?)\s*,\s*\{/g)) {
      const nsExpr = m[1].trim()
      let ns = null
      const quoted = /^(['"])([^'"]+)\1$/.exec(nsExpr)
      if (quoted !== null) ns = quoted[2]
      else {
        ns = literalIn(text, nsExpr)
        if (ns === null) {
          for (const other of files) {
            if (other === file) continue
            const found = literalIn(fs.readFileSync(other, 'utf8'), nsExpr)
            if (found !== null) { ns = found; break }
          }
        }
      }
      if (ns === null) { problems.push(`${pkg} ${rel}: unresolved ns ${nsExpr}`); continue }
      const objectLiteral = sliceObject(text, text.indexOf('{', m.index + m[0].length - 1))
      if (objectLiteral === null) { problems.push(`${pkg} ${rel}: ns ${ns} object literal not closed`); continue }
      const dict = dictFromRegistration(file, text, objectLiteral)
      if (dict === null) { problems.push(`${pkg} ${rel}: ns ${ns} dict not found`); continue }
      const entries = Object.entries(dict).filter(([, value]) => typeof value === 'string')
      out[ns] = { ...(out[ns] ?? {}), ...Object.fromEntries(entries) }
      summary.push(`${pkg} ${rel}: ns=${ns} keys=${entries.length}`)
    }
  }
}

// The composer menu's builtin command spellings live in another package's
// dictionary; supply the six values the literal references.
const builtinCommandTokens = { goal: '\u76ee\u6807', plan: '\u8ba1\u5212', feedback: '\u53cd\u9988', compact: '\u538b\u7f29', permission: '\u6743\u9650', export: '\u5bfc\u51fa' }
if (out.command !== undefined) {
  for (const [name, value] of Object.entries(builtinCommandTokens)) out.command[`token.${name}`] = value
}

fs.writeFileSync('/tmp/dsh-zh-pack.json', JSON.stringify(out, null, 2))
const total = Object.values(out).reduce((n, d) => n + Object.keys(d).length, 0)
console.log(summary.join('\n'))
console.log(`\nnamespaces: ${Object.keys(out).length} | keys: ${total}`)
if (problems.length > 0) if (problems.length > 0) console.log('problems:\n' + problems.join('\n'))
if (markers.length > 0) console.log('dropped marker values:\n' + markers.join('\n'))
