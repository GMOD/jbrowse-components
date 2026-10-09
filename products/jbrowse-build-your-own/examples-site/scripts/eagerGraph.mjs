// Who is actually paying for a module in the eager set?
//
//   pnpm probe-eager-graph                     rebuild with the probe, list the
//                                              20 costliest eager modules
//   pnpm probe-eager-graph --page ultraminimal...for a page other than the
//                                              sparsest one
//   pnpm probe-eager-graph --holds @mui/material/styles
//                                              which first-party eager modules
//                                              statically import it
//   pnpm probe-eager-graph --no-build          reuse the last probe dump
//
// `measure-eager-bundle` answers "how big is the eager set". This answers "why",
// and it is the tool three sessions in a row rebuilt from scratch before it was
// committed. It exists because the two obvious shortcuts are both wrong:
//
// - **Attribute at module level, never by chunk name.** A rolldown chunk takes
//   the name of one of its modules and routinely holds unrelated ones. A chunk
//   called `LinearGenomeView` turned out to be mostly the `@jbrowse/core/ui`
//   barrel, and a 239 KB attribution was published off it before that was
//   caught.
// - **Confirm a suspected pin from the *source* graph, not the bundled one.**
//   Barrels get inlined, so the surviving graph is missing edges the source has,
//   and a walk over it will report a pin gone when it is not. `--holds` reads
//   `buildEnd`'s pre-treeshake graph for that reason, and intersects it with the
//   post-treeshake eager set so it only reports edges that are actually paid
//   for.
//
// If a run fails on a missing dist/_astro, or a page has no chunks, rebuild
// first — the site is rebuilt by other things while you measure.
import { execFileSync } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const site = path.join(here, '..')
const dist = path.join(site, 'dist')
const dumpFile = path.join(site, 'node_modules/.cache/eager-graph.json')

const argv = process.argv.slice(2)
const flag = name => {
  const i = argv.indexOf(name)
  return i === -1 ? undefined : argv[i + 1]
}
const page = flag('--page') ?? 'ultraminimal'
const holds = flag('--holds')

if (!argv.includes('--no-build')) {
  execFileSync(
    'npx',
    ['astro', 'build', '--config', 'astro.config.probe.mjs'],
    { cwd: site, stdio: 'inherit' },
  )
}

if (!existsSync(dumpFile)) {
  console.error(`no probe dump at ${dumpFile} — run without --no-build`)
  process.exit(1)
}
const graph = JSON.parse(readFileSync(dumpFile, 'utf8'))

// the landing page is dist/index.html; every other page is a directory
const htmlFor = p =>
  p === 'index'
    ? path.join(dist, 'index.html')
    : path.join(dist, p, 'index.html')

if (!existsSync(htmlFor(page))) {
  const pages = readdirSync(dist, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_astro')
    .map(d => d.name)
  console.error(`no page "${page}" — have: index, ${pages.join(', ')}`)
  process.exit(1)
}

// The eager set: the closure over **static** chunk imports from the chunks a
// page's HTML names. Same definition as measureEagerBundle.mjs, over the probe's
// chunk records rather than over a re-lex of the output.
const chunkFor = file =>
  graph.chunks[`_astro/${file}`] ?? graph.chunks[file] ?? undefined

const html = readFileSync(htmlFor(page), 'utf8')
const entries = [...html.matchAll(/_astro\/([\w.$-]+\.js)/g)].map(m => m[1])

// A plain `pnpm build` between the probe run and now rewrites dist/ with fresh
// content hashes, and the ones that happen to be unchanged (react, astro's
// runtime) still resolve — so a stale dump does not fail, it silently reports a
// five-chunk eager set for a page with 191. Check the entries the HTML names
// before walking anything.
const missing = entries.filter(f => !chunkFor(f))
if (missing.length) {
  console.error(
    `the probe dump and dist/ are out of step: ${missing.length} of ` +
      `${entries.length} entry chunk(s) for "${page}" are not in the dump ` +
      `(e.g. ${missing[0]}).\nSomething rebuilt dist/ since — rerun without ` +
      '--no-build.',
  )
  process.exit(1)
}

const eagerChunks = new Set()
const queue = [...entries]
while (queue.length) {
  const file = queue.pop()
  const chunk = chunkFor(file)
  if (eagerChunks.has(file) || !chunk) {
    continue
  }
  eagerChunks.add(file)
  queue.push(...chunk.imports.map(i => path.basename(i)))
}

if (eagerChunks.size === 0) {
  console.error(`no chunks matched for "${page}" — rerun without --no-build.`)
  process.exit(1)
}

// module id -> bytes it rendered to, for every module in an eager chunk
const eagerModules = new Map()
for (const file of eagerChunks) {
  for (const [id, bytes] of Object.entries(chunkFor(file).modules)) {
    eagerModules.set(id, (eagerModules.get(id) ?? 0) + bytes)
  }
}

const short = id => path.relative(path.join(site, '../../..'), id)
const firstParty = id => !id.includes('node_modules')

// What a page's OWN graph costs, as opposed to what it downloads.
//
// The eager-chunk sum above is the delivered figure and it is coupled: rolldown
// cuts chunks by which pages reach a module together, so a page that imports
// nothing new still moves when a neighbour is added (~13 KB gzip a page,
// measured). That is honest about bytes on the wire and useless for attribution
// — the number a ratchet wants is the one that only moves when THIS page's
// imports move.
//
// So walk the page's own static graph from its entry modules and count only what
// it reaches. Static edges only: a `dynamic` edge is a chunk the page does not
// download up front, which is the whole distinction being measured. Intersected
// with the eager modules, so a module treeshaken away is not billed.
//
// Two properties to keep in mind before quoting it. It is **uncompressed** —
// gzip does not decompose per module, so this trades unit for stability. And a
// module two pages both import is billed to **both**, so the per-page figures
// deliberately do not sum to the site total.
function attributed(forPage) {
  const roots = [...eagerChunks]
    .map(f => chunkFor(f).facadeModuleId)
    .filter(Boolean)
  if (roots.length === 0) {
    return { modules: 0, bytes: 0, stale: true }
  }
  // Walk the SOURCE graph without gating on the eager set, and bill only the
  // intersection at the end. Gating the traversal instead cuts a subtree off at
  // any module treeshaking removed — an inlined barrel is exactly that, and it
  // sits between a page and most of what it imports, so the first version of
  // this read 54% of synteny as co-location when the real figure is a third of
  // that.
  const seen = new Set()
  const stack = [...roots]
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    stack.push(...(graph.source[id]?.imports ?? []))
  }
  let bytes = 0
  let modules = 0
  for (const id of seen) {
    const cost = eagerModules.get(id)
    if (cost !== undefined) {
      bytes += cost
      modules++
    }
  }
  return { modules, bytes, page: forPage }
}

// Package root of a node_modules path: `.../node_modules/@mui/material/Button/
// Button.mjs` -> `.../node_modules/@mui/material`. What a bare specifier
// resolves to when it names a barrel.
function packageRoot(id) {
  const m = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(id)
  return m ? m[1] : undefined
}

if (holds) {
  const direct = []
  for (const id of eagerModules.keys()) {
    for (const dep of graph.source[id]?.imports ?? []) {
      if (dep.includes(holds)) {
        direct.push({ id, dep })
        break
      }
    }
  }
  const own = direct.filter(i => firstParty(i.id))
  console.log(
    `${direct.length} eager module(s) import something matching "${holds}" ` +
      `on page "${page}" — ${own.length} first-party:\n`,
  )
  for (const { id, dep } of own) {
    console.log(`  ${short(id)}\n      -> ${short(dep)}`)
  }

  // A named import from a barrel — `import { Button } from '@mui/material'` —
  // records an edge to the package's `index.mjs`, and it is *that* module which
  // imports `Button/Button.mjs`. So a direct-importer query for the component
  // finds only node_modules and reads as "chunk co-location, nothing to fix". It
  // said exactly that about `Button` while `wiggle-core/src/ResolutionStepper.tsx`
  // was importing it by name.
  //
  // The barrel edge cannot say *which* export was taken, so this cannot be
  // folded into the answer above — it is a shortlist, not a verdict. Confirm one
  // by grepping the named import.
  if (own.length === 0 && direct.length > 0) {
    const roots = new Set(
      direct.map(({ dep }) => packageRoot(dep)).filter(Boolean),
    )
    const viaBarrel = new Set()
    for (const id of eagerModules.keys()) {
      if (!firstParty(id)) {
        continue
      }
      for (const dep of graph.source[id]?.imports ?? []) {
        if (roots.has(dep.replace(/\/(?:index|esm\/index)\.m?js$/, ''))) {
          viaBarrel.add(id)
        }
      }
    }
    console.log(
      `  no first-party module names it directly. ${viaBarrel.size} import ` +
        'the package barrel, so a named import from one of these is the\n' +
        '  likely holder — grep before believing it:\n',
    )
    for (const id of viaBarrel) {
      console.log(`    ${short(id)}`)
    }
    if (viaBarrel.size === 0) {
      console.log(
        '  none at all. This is chunk co-location, not a source edge: rolldown\n' +
          '  put a dynamic-only module in a chunk something eager imports.',
      )
    }
  }
  process.exit(0)
}

const total = [...eagerModules.values()].reduce((a, b) => a + b, 0)
console.log(
  `page "${page}": ${eagerChunks.size} eager chunks, ${eagerModules.size} ` +
    `modules, ${Math.round(total / 1024)} KB rendered (uncompressed)\n`,
)
const own = attributed(page)
console.log(
  `  of which this page's own static graph reaches: ${own.modules} modules, ` +
    `${Math.round(own.bytes / 1024)} KB — the rest is chunk co-location with ` +
    'other pages\n',
)
const byPackage = new Map()
for (const [id, bytes] of eagerModules) {
  const m =
    /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
      id,
    )
  const key = m ? m[1] : 'first-party'
  byPackage.set(key, (byPackage.get(key) ?? 0) + bytes)
}
console.log('by package:')
for (const [pkg, bytes] of [...byPackage]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)) {
  console.log(`  ${String(Math.round(bytes / 1024)).padStart(5)} KB  ${pkg}`)
}
console.log('\ncostliest modules:')
for (const [id, bytes] of [...eagerModules]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)) {
  console.log(
    `  ${String(Math.round(bytes / 1024)).padStart(5)} KB  ${short(id)}`,
  )
}
