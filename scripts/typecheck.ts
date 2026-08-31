// Picks tsc's checker count instead of letting tsgo derive one from the core
// count, which on 16 cores means 16 and is the worst of the settings measured.
// Whole-repo cold --noEmit with tsconfig.tsbuildinfo cleared (incremental:true
// means an uncleared run measures the cache):
//
//   checkers   1      2      4      8      16 (tsgo default here)
//   seconds    14.4    9.6    8.5    9.1    10.8
//   peak RSS   2.9GB  3.1GB  3.7GB  5.0GB   6.6GB
//
// Four is the knee, and it beats the default on both axes at once, so there is
// no agent tier to carry: three concurrent runs, the most heavy-run-slot.sh
// admits, peak at 11GB against the 15GB that one checker each used to.
// A warm no-op is ~1.0s at any of them.
import { spawn, spawnSync } from 'node:child_process'

// Reports the source actually used, not merely set: TSC_CHECKERS=abc falls back
// to the default, and naming it as the source would blame an unused value.
function resolveCheckers() {
  const override = Number(process.env.TSC_CHECKERS)
  return Number.isInteger(override) && override > 0
    ? { value: String(override), source: 'TSC_CHECKERS' }
    : { value: '4', source: 'set TSC_CHECKERS=<n> to override' }
}

const { value: checkers, source } = resolveCheckers()
const checkerArgs = ['--checkers', checkers]

console.error(`typecheck: --checkers ${checkers} (${source})`)

// The groups `pnpm typecheck` runs, named so package.json spells each list
// once. Any other bare argument is a project path, and an argument starting
// with `-` goes straight through to tsc, so `pnpm typecheck --watch` reaches
// every project rather than reading as a path.
const GROUPS: Record<string, string[]> = {
  web: ['.'],
  node: [
    'products/jbrowse-desktop/electron',
    'products/jbrowse-desktop/test',
    'products/jbrowse-cli',
  ],
}

const args = process.argv.slice(2)
const flags = args.filter(a => a.startsWith('-') && a !== '--noEmit')
const named = args.filter(a => !a.startsWith('-'))
const projects = (named.length > 0 ? named : Object.keys(GROUPS)).flatMap(
  a => GROUPS[a] ?? [a],
)

const tscArgs = (project: string) => [
  'node_modules/typescript7/bin/tsc',
  '--noEmit',
  '-p',
  project,
  ...checkerArgs,
  ...flags,
]

// Watching starts every project at once, since the first watcher never returns.
// Anything else runs one project at a time — together they would restore
// exactly the peak the checker count holds down.
//
// Watch is also the one form that skips heavy-run-slot.sh below, and has to:
// a watcher would hold its slot for the length of the session.
if (flags.some(f => f === '--watch' || f === '-w')) {
  for (const project of projects) {
    spawn(process.execPath, tscArgs(project), { stdio: 'inherit' })
  }
} else {
  // A per-run checker count cannot cap the machine: each checkout picks four
  // as though it were alone, and the checkouts cannot see each other. The slot
  // is machine-wide so they queue instead.
  for (const project of projects) {
    const { status } = spawnSync(
      'scripts/heavy-run-slot.sh',
      [process.execPath, ...tscArgs(project)],
      { stdio: 'inherit' },
    )
    if (status !== 0) {
      process.exit(status ?? 1)
    }
  }
}
