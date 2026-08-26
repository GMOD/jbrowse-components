/**
 * Run every jest suite that reaches the files this branch changed.
 *
 * `pnpm test <directory>` scopes by PATH, so it runs the suites that live beside
 * the change and none of the ones that exercise it from outside. Three suites
 * went red on main in one week that way: a config-slot removal staled
 * `ConfigSlotDefaults`, a menu becoming a submenu broke `AlignmentsFilters`, and
 * a new scalebar caption staled `ReversedRegionLabels` — each change's own tests
 * moved with it, and all three of the suites that caught it live in
 * products/jbrowse-web.
 *
 * jest's `--findRelatedTests` walks the module graph instead, so an integration
 * suite that imports the app — and so, transitively, the changed file — is
 * included. All three above are named by it.
 *
 * Usage: `pnpm test-related [base-ref]` (default `main`). Extra jest flags pass
 * through after `--`.
 */
import { execFileSync } from 'node:child_process'

// Source files only. A changed snapshot, golden or generated doc has no module
// graph to walk, and handing jest a `.snap` makes it match nothing at all —
// which reads as "no related tests" rather than as the no-op it is.
const SOURCE = /\.(ts|tsx|js|jsx)$/
// Their own suites are what `--findRelatedTests` would return for them anyway,
// and passing a test file makes jest run it whether or not the change reaches
// anything else.
const TEST = /\.test\.(ts|tsx)$|\.d\.ts$/

function git(...args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

const argv = process.argv.slice(2)
const passThroughAt = argv.indexOf('--')
const jestArgs = passThroughAt === -1 ? [] : argv.slice(passThroughAt + 1)
const base = (passThroughAt === -1 ? argv : argv.slice(0, passThroughAt))[0]

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

try {
  execFileSync(
    'npx',
    ['jest', '--ci', '--findRelatedTests', ...files, ...jestArgs],
    { stdio: 'inherit' },
  )
} catch {
  process.exit(1)
}
