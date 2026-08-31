/**
 * Run every jest suite that reaches the files this branch changed.
 *
 * `pnpm test <directory>` scopes by PATH, so it runs the suites that live beside
 * the change and none of the ones that exercise it from outside.
 * `--findRelatedTests` walks the module graph instead, so a suite that imports
 * the app — and so, transitively, the changed file — is included.
 *
 * **`products/jbrowse-web` is left out unless the change is in it**, and the
 * reason is that the graph gives no answer there. Every suite in
 * `products/jbrowse-web/src/tests` imports `corePlugins`, so every one of them
 * is related to every file in every plugin: measured 2026-08-30, a change in
 * wiggle, one in variants and one in linear-comparative-view each returned the
 * SAME 164 suites, and a `packages/core` change returned those plus 12. That is
 * a constant, not a selection — and it is 77% of the clock, 224s of a 269-suite
 * run against 52s for the other 131.
 *
 * What that costs is real and worth stating: those suites are the ones that
 * caught a config-slot removal staling `ConfigSlotDefaults`, a menu becoming a
 * submenu breaking `AlignmentsFilters`, and a new scalebar caption staling
 * `ReversedRegionLabels` — each a change whose own tests moved with it. CI runs
 * the whole suite and is where they land now. `--with-web` puts them back.
 *
 * Usage: `pnpm test-related [base-ref] [--with-web]` (default base `main`).
 * Extra jest flags pass through after `--`.
 */
import { execFileSync, spawn } from 'node:child_process'
import readline from 'node:readline'

// Source files only. A changed snapshot, golden or generated doc has no module
// graph to walk, and handing jest a `.snap` makes it match nothing at all —
// which reads as "no related tests" rather than as the no-op it is.
const SOURCE = /\.(ts|tsx|js|jsx)$/
// Their own suites are what `--findRelatedTests` would return for them anyway,
// and passing a test file makes jest run it whether or not the change reaches
// anything else.
const TEST = /\.test\.(ts|tsx)$|\.d\.ts$/
const WEB = 'products/jbrowse-web/'

function git(...args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

const argv = process.argv.slice(2)
const passThroughAt = argv.indexOf('--')
const jestArgs = passThroughAt === -1 ? [] : argv.slice(passThroughAt + 1)
const own = passThroughAt === -1 ? argv : argv.slice(0, passThroughAt)
const withWeb = own.includes('--with-web')
const base = own.find(a => a !== '--with-web')

// Committed changes against the base, plus whatever is still in the working
// tree — a run before committing is the one that saves the round trip.
const ref = base ?? 'main'
const changed = [
  ...git('diff', '--name-only', `${ref}...HEAD`).split('\n'),
  ...git('diff', '--name-only', 'HEAD').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
]
  .map(f => f.trim())
  .filter(f => f && SOURCE.test(f) && !TEST.test(f))

const files = [...new Set(changed)]
if (files.length === 0) {
  console.log(`No changed source files against ${ref} — nothing to run.`)
  process.exit(0)
}

console.log(`${files.length} changed source file(s) against ${ref}:`)
for (const f of files.slice(0, 20)) {
  console.log(`  ${f}`)
}
if (files.length > 20) {
  console.log(`  ... and ${files.length - 20} more`)
}

// A change IN jbrowse-web keeps them: they are the suites that cover it, and
// dropping them would leave the run empty for anyone working on the app.
const touchesWeb = files.some(f => f.startsWith(WEB))
const skipWeb = !withWeb && !touchesWeb

function listRelated() {
  return execFileSync(
    'npx',
    ['jest', '--listTests', '--findRelatedTests', ...files],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  )
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

// `--runTestsByPath` makes jest end with a "Ran all test suites within paths"
// line naming every one of them — ~10KB of absolute paths, into the terminal or
// an agent's context, on every run. Everything else streams through untouched.
const FOOTER = 'Ran all test suites within paths '

async function run(args: string[]) {
  const child = spawn('npx', ['jest', '--ci', ...args, ...jestArgs], {
    stdio: ['inherit', 'inherit', 'pipe'],
  })
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
  if (code !== 0) {
    process.exit(code)
  }
}

if (!skipWeb) {
  await run(['--findRelatedTests', ...files])
} else {
  const all = listRelated()
  const paths = all.filter(p => !p.includes(`/${WEB}`))
  const skipped = all.length - paths.length
  if (skipped) {
    console.log(
      `\nSkipping ${skipped} products/jbrowse-web suite(s): they import corePlugins, so the same set is "related" to any change anywhere and it is most of the run. CI covers them.\n  pnpm test-related ${ref} --with-web    # to include them`,
    )
  }
  if (paths.length === 0) {
    console.log('\nNothing left to run outside products/jbrowse-web.')
    process.exit(0)
  }
  // `--runTestsByPath` rather than re-deriving the set: the list above already
  // is the answer, and asking jest for it twice can only disagree with itself.
  // `--testPathPatterns` is not an option — jest ignores it outright alongside
  // `--findRelatedTests`, which is what a one-invocation version would need.
  await run(['--runTestsByPath', ...paths])
}
