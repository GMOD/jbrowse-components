/**
 * Run the jest suites that executed a file this branch changed.
 *
 * Every jest run records a footprint per suite — the repo files it loaded
 * (`config/jest/footprints.cjs`) — and a suite is selected when its footprint
 * holds a changed file. The static import graph (`--findRelatedTests`) is only
 * the fallback for a suite with no footprint yet, because it cannot
 * discriminate: every jbrowse-web suite imports `corePlugins`, so statically
 * each one is related to nearly every plugin file.
 *
 * A changed file whose compiled output is unchanged — comments, types,
 * formatting — selects nothing.
 *
 * The `jbrowse-web` jest project runs on remote CI; one of its suites runs here
 * only when the change edits that test file, or with `--with-web`.
 *
 * Usage: `pnpm test-related [base-ref] [--with-web]` (default `main`). Extra
 * jest flags pass through after `--`.
 */
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import readline from 'node:readline'

import { transformSync } from '@babel/core'

import { changedFiles, git, lines } from './changedFiles.ts'

const { readFootprints } = createRequire(import.meta.url)(
  '../config/jest/footprints.cjs',
) as {
  readFootprints: (
    cacheDirectory: string,
    checkoutRoots: string[],
  ) => Map<string, Set<string>>
}

const CODE = /\.(ts|tsx|js|jsx|cjs|mjs)$/
const JSX = /\.(tsx|jsx|js)$/
const TEST = /\.test\.(ts|tsx|js|jsx)$/
const NOT_A_SUITE = /(^|\/)(dist|demos)\/|^products\/aws\//
const WEB = 'products/jbrowse-web/'
// Loaded by jest itself or resolved outside the repo, so in no footprint, and
// a change to any of them can move every suite.
const HARNESS =
  /^(jest\.config\.js|babel\.config\.cjs|pnpm-lock\.yaml|config\/jest\/.*\.cjs)$/

const argv = process.argv.slice(2)
const passThroughAt = argv.indexOf('--')
const jestArgs = passThroughAt === -1 ? [] : argv.slice(passThroughAt + 1)
const own = passThroughAt === -1 ? argv : argv.slice(0, passThroughAt)
const withWeb = own.includes('--with-web')
const flags = own.filter(a => a.startsWith('-') && a !== '--with-web')
if (flags.length > 0) {
  console.error(
    `Unknown option ${flags.join(' ')}. Jest flags go after \`--\`.`,
  )
  process.exit(2)
}
const ref = own.find(a => !a.startsWith('-')) ?? 'main'

const root = git('rev-parse', '--show-toplevel').trim()
const jest = path.join(root, 'node_modules/.bin/jest')
const primary = path.dirname(
  path.resolve(root, git('rev-parse', '--git-common-dir').trim()),
)
process.chdir(root)
const { base, files: changed } = changedFiles(ref)
if (changed.length === 0) {
  console.log(`Nothing changed against ${ref}.`)
  process.exit(0)
}

function compiled(source: string, file: string) {
  try {
    return transformSync(source, {
      filename: path.join(root, file),
      babelrc: false,
      configFile: false,
      presets: ['@babel/preset-typescript'],
      parserOpts: { plugins: JSX.test(file) ? ['jsx'] : [] },
      comments: false,
      compact: true,
      sourceMaps: false,
    })?.code
  } catch {
    return undefined
  }
}

function compilesUnchanged(file: string) {
  if (!CODE.test(file) || !fs.existsSync(file)) {
    return false
  }
  let before: string
  try {
    before = git('show', `${base}:${file}`)
  } catch {
    return false
  }
  const after = compiled(fs.readFileSync(file, 'utf8'), file)
  return after !== undefined && after === compiled(before, file)
}

const harness = changed.filter(f => HARNESS.test(f))
const inert = changed.filter(compilesUnchanged)
const live = changed.filter(f => !inert.includes(f))

const cache = path.join(primary, 'node_modules/.cache/jest')
const footprints = readFootprints(cache, [root, primary])

/**
 * What a selection costs, read off jest's own sequencer cache — one
 * `perf-cache-<project>-<hash>` per project, `{ <absolute path>: [failed, ms] }`,
 * keyed in whichever checkout ran it.
 *
 * The MINIMUM across those recordings, never the mean or the median. A duration
 * is only ever what the box allowed that day, and this tree's caches hold
 * `sdEllipse.test.ts` at 6.1s in one checkout and 3979s in another. The floor is
 * the work; everything above it is what the run was sharing the machine with.
 */
function suiteSeconds(tests: string[]) {
  const floor = new Map<string, number>()
  let entries: string[]
  try {
    entries = fs.readdirSync(cache).filter(f => f.startsWith('perf-cache-'))
  } catch {
    return undefined
  }
  const owned =
    /(?:\.claude\/worktrees\/[^/]+\/)?((?:packages|plugins|products|example-plugins|website|scripts)\/.*)$/
  for (const entry of entries) {
    let recorded: Record<string, unknown>
    try {
      recorded = JSON.parse(fs.readFileSync(path.join(cache, entry), 'utf8'))
    } catch {
      continue
    }
    for (const [key, value] of Object.entries(recorded)) {
      const test = owned.exec(key)?.[1]
      const ms = Array.isArray(value) ? value[1] : undefined
      if (test !== undefined && typeof ms === 'number') {
        floor.set(test, Math.min(floor.get(test) ?? Infinity, ms))
      }
    }
  }
  if (floor.size === 0) {
    return undefined
  }
  // A suite nothing has run yet is priced at the median of the ones that have,
  // which is the only estimate available and is right within a factor of a few
  // for all but the app-level suites.
  const sorted = [...floor.values()].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  return tests.reduce((sum, t) => sum + (floor.get(t) ?? median), 0) / 1000
}

const selected = new Set(live.filter(f => TEST.test(f) && fs.existsSync(f)))
const liveSources = live.filter(f => !TEST.test(f))
for (const [test, files] of footprints) {
  if (fs.existsSync(test) && liveSources.some(f => files.has(f))) {
    selected.add(test)
  }
}

const unrecorded = lines(git('ls-files', '*.test.*')).filter(
  f => TEST.test(f) && !NOT_A_SUITE.test(f) && !footprints.has(f),
)
const staticInputs = liveSources.filter(
  f => fs.existsSync(f) && (CODE.test(f) || f.endsWith('.json')),
)
let byGraph = 0
if (unrecorded.length > 0 && staticInputs.length > 0) {
  const missing = new Set(unrecorded)
  const related = lines(
    execFileSync(jest, ['--listTests', '--findRelatedTests', ...staticInputs], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  )
  for (const abs of related) {
    const test = path.relative(root, abs)
    if (missing.has(test) && !selected.has(test)) {
      selected.add(test)
      byGraph++
    }
  }
}

const skippedWeb = withWeb
  ? []
  : [...selected].filter(t => t.startsWith(WEB) && !live.includes(t))
for (const t of skippedWeb) {
  selected.delete(t)
}

console.log(
  `${changed.length} changed file(s) against ${ref}, ${inert.length} compiling to identical output`,
)
const cost = suiteSeconds([...selected])
const priced =
  cost === undefined
    ? ''
    : `, ~${cost.toFixed(cost < 10 ? 1 : 0)}s of suite time`
console.log(
  `${selected.size} suite(s)${priced}, ${byGraph} of those picked by the static graph because ${unrecorded.length} suite(s) have no footprint yet`,
)
if (skippedWeb.length > 0) {
  console.log(
    `Skipped ${skippedWeb.length} products/jbrowse-web suite(s) that executed the change; remote CI runs them, --with-web runs them here.`,
  )
}
if (harness.length > 0) {
  console.log(
    `${harness.join(', ')} changed, which no footprint records; \`pnpm test\` runs every suite outside jbrowse-web.`,
  )
}
if (selected.size === 0) {
  process.exit(0)
}

// `--runTestsByPath` ends with a "Ran all test suites within paths" line naming
// every path, which is kilobytes of noise in an agent's context.
const FOOTER = 'Ran all test suites within paths '

// Through the same machine-wide slots the typechecks queue on, and for the same
// reason: a per-run budget cannot see the other agents, so eight sessions each
// sizing themselves down still put eight jest runs on the box at once. The slot
// is taken here rather than around the whole script, so a change that selects
// nothing never joins the queue.
const child = spawn(
  path.join(root, 'scripts/heavy-run-slot.sh'),
  [jest, '--ci', '--runTestsByPath', ...selected, ...jestArgs],
  { stdio: ['inherit', 'inherit', 'pipe'] },
)
for await (const line of readline.createInterface({ input: child.stderr })) {
  if (!line.startsWith(FOOTER)) {
    process.stderr.write(`${line}\n`)
  }
}
const code = await new Promise<number>(resolve => {
  child.on('close', c => {
    resolve(c ?? 1)
  })
})
process.exit(code)
