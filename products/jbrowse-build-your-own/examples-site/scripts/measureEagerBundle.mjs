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
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

import { init, parse } from 'es-module-lexer/minimal'

import { pages as examplePages } from '../src/examples.ts'
import { eagerGraphFile } from './eagerGraphDump.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const site = path.join(here, '..')
const dist = path.join(site, 'dist')
const budgetFile = path.join(site, 'eagerBundleSizes.json')
const floorFile = path.join(site, 'eagerFloor.json')

// The band around a committed figure. A dependency bump moves these numbers by
// a few KB and rolldown re-chunks on its own, so neither edge is tight; the
// regressions this exists to catch are 50-150 KB, an order of magnitude clear
// of `OVER_KB`. `UNDER_KB` is the ratchet: drift far enough below and the
// budget is stale, which is the failure a pure ceiling never reports.
const OVER_KB = 10
const UNDER_KB = 25

// The page every other one pays for: what it downloads up front is the engine
// itself. Banked by source directory, uncompressed (gzip does not decompose per
// module), so a re-bank's diff names where the bytes went.
const FLOOR_PAGE = 'index'
const MOVER_KB = 2

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

const pages = ['index', ...examplePages.map(e => e.slug).sort()]

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

// `npm:<package>`, or a first-party package and its first directory under
// src: `packages/core/util`, `plugins/marks/LinearMarkDisplay`
function directoryOf(id) {
  const npm =
    /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
      id,
    )
  const own = /\/(packages|plugins|products)\/([^?]*)/.exec(id)
  return npm
    ? `npm:${npm[1]}`
    : own
      ? [
          own[1],
          ...own[2]
            .split('/')
            .filter(p => p !== 'src')
            .slice(0, 2),
        ]
          .join('/')
          .replace(/\.[cm]?[jt]sx?$/, '')
      : 'other'
}

function floorByDirectory() {
  const graph = JSON.parse(readFileSync(eagerGraphFile, 'utf8'))
  const bytes = new Map()
  for (const file of eagerSet(FLOOR_PAGE)) {
    const chunk = graph.chunks[`_astro/${file}`]
    if (!chunk) {
      throw new Error(
        `${eagerGraphFile} does not describe dist/_astro/${file}: rebuild`,
      )
    }
    for (const [id, length] of Object.entries(chunk.modules)) {
      const dir = directoryOf(id)
      bytes.set(dir, (bytes.get(dir) ?? 0) + length)
    }
  }
  return Object.fromEntries(
    [...bytes]
      .map(([dir, b]) => [dir, Math.round(b / 1024)])
      .filter(([, kb]) => kb > 0)
      .sort((a, b) => b[1] - a[1]),
  )
}

function floorMovers(banked, now) {
  return [...new Set([...Object.keys(banked), ...Object.keys(now)])]
    .map(dir => ({ dir, was: banked[dir] ?? 0, is: now[dir] ?? 0 }))
    .filter(({ was, is }) => Math.abs(is - was) >= MOVER_KB)
    .sort((a, b) => b.is - b.was - (a.is - a.was))
    .map(
      ({ dir, was, is }) =>
        `  ${is > was ? '+' : ''}${is - was} KB  ${dir} (${was} -> ${is})`,
    )
}

const floor = floorByDirectory()
// nothing banked yet reads as every directory having grown from zero
const bankedFloor = existsSync(floorFile)
  ? JSON.parse(readFileSync(floorFile, 'utf8'))
  : {}
const movers = floorMovers(bankedFloor, floor)
const moversReport = movers.length
  ? `\n\nSince the last bank, the ${FLOOR_PAGE} page's up-front modules moved ` +
    `(uncompressed, by directory):\n${movers.join('\n')}`
  : `\n\nThe ${FLOOR_PAGE} page's up-front modules moved by under ${MOVER_KB} KB ` +
    'in every directory since the last bank.'

const rows = pages.map(
  p =>
    `  ${p.padEnd(26)} ${String(measured[p].gzipKb).padStart(4)} KB gzip` +
    `  (${measured[p].chunks} chunks)`,
)

if (process.argv.includes('--check')) {
  const budget = JSON.parse(readFileSync(budgetFile, 'utf8'))
  const problems = Object.keys(budget)
    .filter(page => !pages.includes(page))
    .map(page => `${page}: budget entry for a page that no longer exists`)
  for (const page of pages) {
    const allowed = budget[page]?.gzipKb
    if (allowed === undefined) {
      problems.push(`${page}: no budget entry — run this without --check`)
      continue
    }
    const { gzipKb } = measured[page]
    if (gzipKb > allowed + OVER_KB) {
      problems.push(
        `${page}: ${gzipKb} KB gzip eager, over its ${allowed} KB budget.`,
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
    console.error(
      `eager bundle budget:\n${problems.join('\n')}${moversReport}\n\n` +
        'A directory that jumped alone is usually a pin: something behind a ' +
        'dynamic import is now statically reachable from an eager module (a ' +
        "plugin's index.ts, an RPC method naming its execute body, a model " +
        'naming a React component). `pnpm probe-eager-graph --holds <path>` ' +
        'names the importer. A page added or removed moves every page 12-14 KB ' +
        'with no directory moving. Re-banking (run without --check) writes ' +
        'eagerFloor.json too, so its diff names what grew: say why in the ' +
        'commit. agent-docs/reference/EAGER_BUNDLE.md has the measurements.',
    )
    process.exit(1)
  }
  console.log(`eager bundle within budget:\n${rows.join('\n')}`)
} else {
  writeFileSync(budgetFile, `${JSON.stringify(measured, null, 2)}\n`)
  writeFileSync(floorFile, `${JSON.stringify(floor, null, 2)}\n`)
  console.log(
    `${rows.join('\n')}${moversReport}\n\nwrote ` +
      `${path.relative(site, budgetFile)} and ${path.relative(site, floorFile)}`,
  )
}
