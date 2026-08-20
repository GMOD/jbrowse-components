// One command for the CI gates that nothing local runs.
//
//   pnpm verify          the fast gates (seconds to ~2 min)
//   pnpm verify --full   adds `autogen --check` and `check-docs` (~5 min)
//
// The definition of done in agent-docs/CLAUDE.md is typecheck, scoped tests,
// lint. Three CI jobs are gated by none of those — `check-format`, `check-docs`
// and the spell check — so a change can be green by every measure an author
// runs and still land red. On 2026-08-12 all three were red on `main` at once,
// and the format failures had arrived on three different commits, which is what
// says it was a gate nobody ran rather than one slip. The repo has 21 separate
// check/lint/format scripts and, until this file, nothing that ran a useful
// subset of them together.
//
// Every gate runs even after one fails, and the summary lists all of them. That
// is the same lesson scripts/autogen.ts records in its own header: CI used to
// report only the first stale artifact, so fixing it revealed the next, and the
// loop cost a push per failure. Reporting one gate at a time costs the same.
//
// Deliberately NOT here: `pnpm test`. Which tests to run is a judgement about
// what you touched — CLAUDE.md is explicit that a scoped `pnpm test <dir>` is
// the right call and that a full-suite run from the shared checkout actively
// lies, because other agents edit the tree mid-run.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const full = process.argv.includes('--full')

interface Gate {
  name: string
  argv: string[]
  // Skipped with a warning when the binary is absent, rather than failing the
  // run. Same treatment build-shaders gives naga and glslangValidator: a
  // contributor without the tool installed still gets every other gate, and CI
  // installs it so the check still happens before merge.
  optionalBinary?: string
  // Costs minutes; only under --full.
  slow?: boolean
}

const pnpm = (script: string) => ['pnpm', script]

const GATES: Gate[] = [
  // Cheapest first, so the common failure is also the fastest to hear about.
  { name: 'format', argv: pnpm('check-format') },
  // Milliseconds, and it is the only gate that sees a case-only module
  // collision at all: `typecheck` runs --noEmit, so nothing collides there, and
  // `build:esm` is not a gate here. See the script's header.
  { name: 'case collisions', argv: pnpm('check-case-collisions') },
  { name: 'spelling', argv: ['typos'], optionalBinary: 'typos' },
  { name: 'lint', argv: pnpm('lint') },
  { name: 'lint (eslint)', argv: pnpm('lint:eslint') },
  { name: 'typecheck', argv: pnpm('typecheck') },
  {
    name: 'generated artifacts',
    argv: ['pnpm', 'autogen', '--check'],
    slow: true,
  },
  { name: 'docs', argv: pnpm('check-docs'), slow: true },
]

function have(bin: string) {
  return (
    spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], {
      stdio: 'ignore',
    }).status === 0
  )
}

const failed: string[] = []
const skipped: string[] = []

for (const gate of GATES) {
  if (gate.slow && !full) {
    continue
  }
  if (gate.optionalBinary && !have(gate.optionalBinary)) {
    console.warn(
      `\n=== ${gate.name}: SKIPPED — \`${gate.optionalBinary}\` is not installed. ` +
        `CI still runs it, so this can fail after you push.`,
    )
    skipped.push(gate.name)
    continue
  }
  console.log(`\n=== ${gate.name}`)
  const { status } = spawnSync(gate.argv[0]!, gate.argv.slice(1), {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (status !== 0) {
    failed.push(gate.name)
  }
}

if (!full) {
  console.log(
    `\nSkipped the slow gates (generated artifacts, docs). ` +
      `Run \`pnpm verify --full\` before pushing something that touched a doc, ` +
      `a JSDoc tag, or anything a generator reads.`,
  )
}

if (failed.length > 0) {
  console.error(`\n${failed.length} gate(s) failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(
  `\nAll gates passed${skipped.length > 0 ? ` (${skipped.join(', ')} skipped)` : ''}`,
)
