// One command for the CI gates that nothing local runs.
//
//   pnpm verify          the fast gates over what this branch changed (seconds)
//   pnpm verify --all    the fast gates over the whole tree, as CI runs them
//   pnpm verify --full   adds `autogen --check`, `check-docs`, `build:esm` (~5 min)
//
// The definition of done in agent-docs/CLAUDE.md is typecheck, scoped tests,
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

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { changedFiles } from './changedFiles.ts'

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
  {
    name: 'format',
    argv: scoped(pnpm('check-format'), files => [
      bin('oxfmt'),
      '--check',
      '--no-error-on-unmatched-pattern',
      ...files,
    ]),
  },
  {
    name: 'format (astro)',
    argv: scoped([], files => {
      const astro = files.filter(f => f.endsWith('.astro'))
      return astro.length > 0
        ? [bin('prettier'), '--check', ...astro]
        : undefined
    }),
  },
  // Milliseconds, and it is the only gate that sees a case-only module
  // collision at all: `typecheck` runs --noEmit, so nothing collides there, and
  // `build:esm` is not a gate here. See the script's header.
  { name: 'case collisions', argv: nodeScript('check-case-collisions.ts') },
  {
    name: 'spelling',
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
  {
    name: 'generated artifacts',
    argv: ['pnpm', 'autogen', '--check'],
    slow: true,
  },
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

const failed: string[] = []
const skipped: string[] = []

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
  console.log(`\n=== ${gate.name}`)
  const { status } = spawnSync(argv[0]!, argv.slice(1), {
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
    `\nSkipped the slow gates (generated artifacts, docs, esm build). ` +
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
