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
import { spawnSync } from 'node:child_process'

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

// No argument means the root project. Otherwise each argument is a `-p`
// project, run one at a time — together they would restore exactly the peak the
// checker count holds down.
const projects = process.argv.slice(2)
const runs = projects.length > 0 ? projects.map(p => ['-p', p]) : [[]]

for (const projectArgs of runs) {
  const { status } = spawnSync(
    process.execPath,
    [
      'node_modules/typescript7/bin/tsc',
      '--noEmit',
      ...projectArgs,
      ...checkerArgs,
    ],
    { stdio: 'inherit' },
  )
  if (status !== 0) {
    process.exit(status ?? 1)
  }
}
