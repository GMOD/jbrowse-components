// What does a page here actually download before it can run?
//
//   node scripts/measureEagerBundle.mjs           re-measure and rewrite
//   node scripts/measureEagerBundle.mjs --check   fail if a page went over
//
// `pnpm measure-chrome-bundle` at the repo root answers a narrower question —
// what the *status chrome* costs, bundled on its own — and it is the figure the
// landing page quotes. This answers the one a reader actually has: I pasted the
// example, what did my users download. Nothing measured that until 2026-08, and
// the answer was 1.8 MB (667 KB gzipped) across 347 chunks on the page whose
// prose is "a measured div and one track, nothing else".
//
// The eager set is the transitive closure over **static** imports from the
// chunks a page's HTML names. A dynamic `import()` is excluded, which is the
// whole point: everything JBrowse defers — every renderer, every display body,
// every dialog — is deferred, and this counts what is left. `es-module-lexer`
// rather than a regex because it is the one thing that reliably tells the two
// apart in minified output.
//
// The budget is a **ceiling with a ratchet**, not the equality
// `chromeBundleSizes.json` uses. Exact bytes here move with any dependency bump
// and with rolldown's chunking, so equality would be a standing nuisance; but a
// pure ceiling only ever rots upward, so going far enough *under* one fails too
// and asks you to bank the win.
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

import { init, parse } from 'es-module-lexer'

const here = path.dirname(fileURLToPath(import.meta.url))
const site = path.join(here, '..')
const dist = path.join(site, 'dist')
const budgetFile = path.join(site, 'eagerBundleSizes.json')

// The band around a committed figure. A dependency bump moves these numbers by
// a few KB and rolldown re-chunks on its own, so neither edge is tight; the
// regressions this exists to catch are 50-150 KB, an order of magnitude clear
// of `OVER_KB`. `UNDER_KB` is the ratchet: drift far enough below and the
// budget is stale, which is the failure a pure ceiling never reports.
const OVER_KB = 10
const UNDER_KB = 25

await init

const astroDir = path.join(dist, '_astro')
const chunks = new Map()
for (const file of readdirSync(astroDir).filter(f => f.endsWith('.js'))) {
  const source = readFileSync(path.join(astroDir, file), 'utf8')
  const [imports] = parse(source, file)
  chunks.set(file, {
    gzipBytes: gzipSync(source).byteLength,
    // i.d === -1 marks a static import; anything else is `import(...)`
    static: imports
      .filter(i => i.d === -1 && i.n?.endsWith('.js'))
      .map(i => path.basename(i.n)),
  })
}

// the landing page is `index`: it runs a demo of its own, so it downloads the
// engine like every other page here, but it is dist/index.html rather than a
// directory of its own
const htmlFor = page =>
  page === 'index'
    ? path.join(dist, 'index.html')
    : path.join(dist, page, 'index.html')

function eagerSet(page) {
  const html = readFileSync(htmlFor(page), 'utf8')
  const seen = new Set()
  const queue = [...html.matchAll(/_astro\/([\w.$-]+\.js)/g)].map(m => m[1])
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file) || !chunks.has(file)) {
      continue
    }
    seen.add(file)
    queue.push(...chunks.get(file).static)
  }
  return seen
}

const pages = [
  'index',
  ...readdirSync(dist, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_astro')
    .map(d => d.name)
    .sort(),
]

const measured = {}
for (const page of pages) {
  const set = eagerSet(page)
  measured[page] = {
    chunks: set.size,
    gzipKb: Math.round(
      [...set].reduce((a, f) => a + chunks.get(f).gzipBytes, 0) / 1024,
    ),
  }
}

const rows = pages.map(
  p =>
    `  ${p.padEnd(26)} ${String(measured[p].gzipKb).padStart(4)} KB gzip` +
    `  (${measured[p].chunks} chunks)`,
)

if (process.argv.includes('--check')) {
  const budget = JSON.parse(readFileSync(budgetFile, 'utf8'))
  const problems = []
  for (const page of pages) {
    const allowed = budget[page]?.gzipKb
    if (allowed === undefined) {
      problems.push(`${page}: no budget entry — run this without --check`)
      continue
    }
    const { gzipKb } = measured[page]
    if (gzipKb > allowed + OVER_KB) {
      problems.push(
        `${page}: ${gzipKb} KB gzip eager, over its ${allowed} KB budget. ` +
          'Three causes, and this figure cannot tell them apart — ' +
          '`pnpm probe-eager-graph` can. A pin: something behind a dynamic ' +
          'import is now statically reachable from an eagerly-evaluated ' +
          'module (a plugin `exports` object, a state model naming a React ' +
          'component, a menu-items file), which is the one worth reverting. A ' +
          'page added or removed anywhere on the site, which re-partitions ' +
          'chunks and moves EVERY page 12-14 KB without any page importing ' +
          'anything new. Or diffuse growth in the state models that are eager ' +
          'by construction, which is what a whole release of feature work ' +
          'looks like and is banked by re-running without --check. Every ' +
          'page over by a similar amount is the shape of the last two; one ' +
          'page over alone is the shape of the first. ' +
          'agent-docs/reference/EAGER_BUNDLE.md has the measurements.',
      )
    } else if (gzipKb < allowed - UNDER_KB) {
      problems.push(
        `${page}: ${gzipKb} KB gzip eager, ${allowed - gzipKb} KB under its ` +
          `${allowed} KB budget. Re-run without --check and commit, so the win ` +
          'is held rather than available to spend.',
      )
    }
  }
  if (problems.length) {
    console.error(`eager bundle budget:\n${problems.join('\n')}`)
    process.exit(1)
  }
  console.log(`eager bundle within budget:\n${rows.join('\n')}`)
} else {
  writeFileSync(budgetFile, `${JSON.stringify(measured, null, 2)}\n`)
  console.log(`${rows.join('\n')}\nwrote ${path.relative(site, budgetFile)}`)
}
