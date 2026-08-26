// Picks tsc's checker count instead of letting tsgo derive one from the core
// count. Measured on 16 cores, whole-repo --noEmit with tsconfig.tsbuildinfo
// cleared (incremental:true means an uncleared run measures the cache):
//
//   cold  default 45.6s 5.98GB   --checkers 1 60.6s 4.40GB
//   warm  default  1.8s 1.13GB   --checkers 1  2.3s 0.91GB
//
// One checker trades ~15s cold for 1.6GB. Agents get it because several
// typecheck and test concurrently, each sizing itself as though alone; CI does
// not, since wall-clock is its only currency. CLAUDECODE is exported by the
// Claude Code CLI into every command it runs and is in no shell profile, so it
// marks agent runs and only agent runs.
import { spawn, spawnSync } from 'node:child_process'

// Reports the source actually used, not merely set: TSC_CHECKERS=abc falls
// through to the agent tier, and naming it there would blame an unused value.
function resolveCheckers() {
  const override = Number(process.env.TSC_CHECKERS)
  if (Number.isInteger(override) && override > 0) {
    return { value: String(override), source: 'TSC_CHECKERS' }
  }
  return process.env.CLAUDECODE
    ? { value: '1', source: 'agent session, set TSC_CHECKERS=<n> to override' }
    : { value: undefined, source: 'tsgo default' }
}

const { value: checkers, source } = resolveCheckers()
const checkerArgs = checkers ? ['--checkers', checkers] : []

console.error(
  checkers
    ? `typecheck: --checkers ${checkers} (${source})`
    : 'typecheck: tsgo default checkers',
)

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
  // One checker each still totals one per checkout, and the checkouts cannot
  // see each other. The slot is machine-wide so they queue instead.
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
