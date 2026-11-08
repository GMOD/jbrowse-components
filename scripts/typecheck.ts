// Typechecks with tsrs, the Rust port of tsc (TypeScript 7.1), which takes
// tsgo's flags. `build:esm` stays on the `typescript7` (7.0) devDependency,
// since this script only checks and that one emits.
//
// Picks the checker count. Whole-repo cold --noEmit with tsconfig.tsbuildinfo
// cleared (incremental:true means an uncleared run measures the cache), on ada
// on 2026-11-08:
//
//   checkers   1      2      4 (default)
//   seconds    4.0    2.8    1.8
//   peak RSS   1.3GB  1.4GB  1.6GB
//
// tsgo 7.0 took 8.7s and 5.7GB at 4 on the same tree.
//
// Agent runs take 2. Several agents typecheck at once, so the cores are already
// taken and extra checkers mostly queue for them, while each run still pays for
// them. A human at a terminal keeps 4.
import { spawn, spawnSync } from 'node:child_process'

// Reports the source actually used, not merely set: TSC_CHECKERS=abc falls back
// to the default, and naming it as the source would blame an unused value.
function resolveCheckers() {
  const override = Number(process.env.TSC_CHECKERS)
  return Number.isInteger(override) && override > 0
    ? { value: String(override), source: 'TSC_CHECKERS' }
    : {
        value: process.env.CLAUDECODE ? '2' : '4',
        source: 'set TSC_CHECKERS=<n> to override',
      }
}

const { value: checkers, source } = resolveCheckers()
const checkerArgs = ['--checkers', checkers]

if (!process.env.JB_TYPECHECK_IN_SLOT) {
  console.error(`typecheck: --checkers ${checkers} (${source})`)
}

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
  'node_modules/tsrs/bin/tsrs',
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
  // A per-run checker count cannot cap the machine: each checkout picks its
  // count as though it were alone, and the checkouts cannot see each other. The slot
  // is machine-wide so they queue instead. The script re-runs itself inside one
  // slot, so a contended run queues once rather than once per project.
  if (!process.env.JB_TYPECHECK_IN_SLOT) {
    const { status } = spawnSync(
      'scripts/heavy-run-slot.sh',
      [process.execPath, ...process.execArgv, import.meta.filename, ...args],
      {
        stdio: 'inherit',
        env: { ...process.env, JB_TYPECHECK_IN_SLOT: '1' },
      },
    )
    process.exit(status ?? 1)
  }
  for (const project of projects) {
    const { status } = spawnSync(process.execPath, tscArgs(project), {
      stdio: 'inherit',
    })
    if (status !== 0) {
      process.exit(status ?? 1)
    }
  }
}
