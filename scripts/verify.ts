// One command for the CI gates that nothing local runs.
//
//   pnpm verify          the fast gates over what this branch changed (seconds)
//   pnpm verify --all    the fast gates over the whole tree, as CI runs them
//   pnpm verify --full   adds `check-docs` and `build:esm`
//
// Not `autogen --check`: pre-push regenerates and commits stale artifacts, so
// checking them here only costs the ~30s whole-repo doc program.
//   --no-cache           reruns gates that already passed on this exact tree
//                        (`scripts/gatePassCache.ts`)
//
// The definition of done in CLAUDE.md § Tooling is typecheck, scoped tests,
// lint. Three CI jobs are gated by none of those — `check-format`, `check-docs`
// and the spell check — so a change can be green by every measure an author
// runs and still land red. On 2026-08-12 all three were red on `main` at once,
// and the format failures had arrived on three different commits, which is what
// says it was a gate nobody ran rather than one slip.
//
// Format, spelling and both linters take the files changed against `main`
// (`scripts/changedFiles.ts`). oxfmt, typos and eslint judge a file on its own
// text, so the scoped run is exact for them; type-aware oxlint can flag an
// unchanged file after a type it reads moves, which `--all` and CI still catch.
// Scoped, eslint is ~3s where the whole tree is ~95s. Typecheck is
// whole-program either way and ~2s warm.
//
// Every gate runs even after one fails, and the summary lists all of them. That
// is the same lesson scripts/autogen.ts records in its own header: CI used to
// report only the first stale artifact, so fixing it revealed the next, and the
// loop cost a push per failure.
//
// Deliberately NOT here: `pnpm test-related`, which answers a different
// question — what the change broke rather than whether it is well-formed.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, lstatSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { changedFiles } from './changedFiles.ts'
import { gatePassCache } from './gatePassCache.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const full = process.argv.includes('--full')
const all = process.argv.includes('--all')

interface Gate {
  name: string
  // A function is the gate's argv over the changed files, or undefined when
  // none of them is its kind of file.
  argv: string[] | ((files: string[]) => string[] | undefined)
  // Skipped with a warning when the binary is absent, rather than failing the
  // run. Same treatment build-shaders gives naga and glslangValidator: a
  // contributor without the tool installed still gets every other gate, and CI
  // installs it so the check still happens before merge.
  optionalBinary?: string
  // Costs minutes; only under --full.
  slow?: boolean
  // Holds no heavy slot, so it runs alongside the gates that do, its output
  // held until no other gate is writing to the terminal.
  concurrent?: boolean
}

const pnpm = (script: string) => ['pnpm', script]
// A pnpm invocation costs ~2s before its script starts, so the gates that are
// plain node scripts run as node.
const nodeScript = (file: string) => [
  process.execPath,
  '--experimental-strip-types',
  join(root, 'scripts', file),
]
const bin = (name: string) => join(root, 'node_modules/.bin', name)
const ESLINT_FILES = /\.(js|cjs|mjs|jsx|ts|cts|mts|tsx|astro)$/

function scoped(
  whole: string[],
  over: (files: string[]) => string[] | undefined,
): Gate['argv'] {
  return all ? whole : over
}

const GATES: Gate[] = [
  // Cheapest first, so the common failure is also the fastest to hear about.
  // The concurrent ones report as they finish, the rest in this order.
  {
    name: 'format',
    concurrent: true,
    argv: scoped(pnpm('check-format'), files => [
      bin('oxfmt'),
      '--check',
      '--no-error-on-unmatched-pattern',
      ...files,
    ]),
  },
  {
    name: 'format (astro)',
    concurrent: true,
    argv: scoped([], files => {
      // prettier refuses a symlink named on its command line, and the shared
      // layouts symlinked into each examples-site are checked at their target
      const astro = files.filter(
        f => f.endsWith('.astro') && !lstatSync(join(root, f)).isSymbolicLink(),
      )
      return astro.length > 0
        ? [bin('prettier'), '--check', ...astro]
        : undefined
    }),
  },
  // Milliseconds, and it is the only gate that sees a case-only module
  // collision at all: `typecheck` runs --noEmit, so nothing collides there, and
  // `build:esm` is not a gate here. See the script's header.
  {
    name: 'case collisions',
    concurrent: true,
    argv: nodeScript('check-case-collisions.ts'),
  },
  {
    name: 'spelling',
    concurrent: true,
    argv: scoped(['typos'], files => ['typos', '--force-exclude', ...files]),
    optionalBinary: 'typos',
  },
  {
    name: 'lint',
    argv: scoped(pnpm('lint'), files => [
      join(root, 'scripts/heavy-run-slot.sh'),
      bin('oxlint'),
      '--type-aware',
      '--deny-warnings',
      '--no-error-on-unmatched-pattern',
      '--',
      ...files,
    ]),
  },
  {
    name: 'lint (eslint)',
    concurrent: true,
    argv: scoped(pnpm('lint:eslint'), files => {
      const lintable = files.filter(f => ESLINT_FILES.test(f))
      return lintable.length > 0
        ? [
            bin('eslint'),
            '--max-warnings',
            '0',
            '--no-warn-ignored',
            ...lintable,
          ]
        : undefined
    }),
  },
  { name: 'typecheck', argv: nodeScript('typecheck.ts') },
  { name: 'docs', argv: pnpm('check-docs'), slow: true },
  // Last: `build:esm` is the only thing that compiles what we PUBLISH — each
  // package's own tsconfig, without node types and without the React compiler
  // — so `typecheck` does not stand in for it: a node-only helper
  // imported from browser source typechecks against the root config and breaks
  // here. That is how main broke on 2026-08-13, and a case-only module collision
  // (see the gate above) is how it broke again for days on 2026-08-20, with
  // TS6305 cascades that read as ordinary staleness.
  //
  // Incremental, so the cost is seconds once warm and minutes on a cold
  // checkout — which is why it is `slow` rather than in the cheap tier.
  { name: 'esm build', argv: pnpm('build:esm'), slow: true },
]

function have(name: string) {
  return (
    spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], {
      stdio: 'ignore',
    }).status === 0
  )
}

const changed = all
  ? []
  : changedFiles('main').files.filter(f => existsSync(join(root, f)))
if (!all) {
  console.log(
    `Format, spelling and lint over the ${changed.length} file(s) changed against main; --all for the whole tree.`,
  )
}

const passes = gatePassCache(root, !process.argv.includes('--no-cache'))
const failed: string[] = []
const skipped: string[] = []
const cached: string[] = []
const running: Promise<void>[] = []
// A held gate's report waits here while an inherited one has the terminal.
const reports: string[] = []

function run(argv: string[], held: boolean) {
  return new Promise<{ status: number | null; output: string }>(resolve => {
    const output: Buffer[] = []
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: root,
      stdio: held ? 'pipe' : 'inherit',
      shell: process.platform === 'win32',
    })
    child.stdout?.on('data', (b: Buffer) => {
      output.push(b)
    })
    child.stderr?.on('data', (b: Buffer) => {
      output.push(b)
    })
    child.on('error', e => {
      output.push(Buffer.from(`${e}\n`))
    })
    child.on('close', status => {
      resolve({ status, output: Buffer.concat(output).toString() })
    })
  })
}

function flushReports() {
  for (const report of reports.splice(0)) {
    process.stdout.write(report)
  }
}

for (const gate of GATES) {
  if (gate.slow && !full) {
    continue
  }
  const argv =
    typeof gate.argv === 'function'
      ? changed.length > 0
        ? gate.argv(changed)
        : undefined
      : gate.argv
  if (!argv || argv.length === 0) {
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
  const { name } = gate
  if (passes.passed(argv)) {
    reports.push(`\n=== ${name}: passed on this exact tree already\n`)
    cached.push(name)
    continue
  }
  const settle = (status: number | null) => {
    if (status === 0) {
      passes.record(argv)
    } else {
      failed.push(name)
    }
  }
  if (gate.concurrent) {
    running.push(
      run(argv, true).then(({ status, output }) => {
        reports.push(`\n=== ${name}\n${output}`)
        settle(status)
      }),
    )
    continue
  }
  flushReports()
  console.log(`\n=== ${name}`)
  settle((await run(argv, false)).status)
}
await Promise.all(running)
flushReports()
passes.save()

if (cached.length > 0) {
  console.log(
    `\nSkipped as already passed on this tree: ${cached.join(', ')}. ` +
      `--no-cache reruns them.`,
  )
}

if (!full) {
  console.log(
    `\nSkipped the slow gates (docs, esm build). ` +
      `Run \`pnpm verify --full\` before landing something that touched a doc ` +
      `or an exported type.`,
  )
}

if (failed.length > 0) {
  console.error(`\n${failed.length} gate(s) failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(
  `\nAll gates passed${skipped.length > 0 ? ` (${skipped.join(', ')} skipped)` : ''}`,
)
