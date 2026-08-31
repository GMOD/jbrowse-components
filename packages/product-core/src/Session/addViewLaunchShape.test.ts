import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// `addView(type, snapshot)` takes the one authoring shape a view has: every
// setting written directly on the snapshot. The v4 nesting under `init` is
// still ACCEPTED — a config or an embedded host mid-deprecation can still send
// it, and `withLaunchInput` lifts it and warns — so nothing fails when a
// launcher inside the tree writes it, except the warning, which is aimed at
// someone who cannot fix our code.
//
// Four launchers wrote it (grid-bookmark's bookmark navigation, maf's
// open-sample and row-synteny, the synteny mate opener) plus jbrowse-img's
// per-mode builder, and none of their tests could tell: the picture is the same
// either way. This is what tells.
const ROOTS = ['packages', 'plugins', 'products']

const repo = path.join(__dirname, '..', '..', '..', '..')

const SKIP = new Set(['node_modules', 'esm', 'dist', 'build', 'coverage'])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      return SKIP.has(entry) ? [] : walk(full)
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : []
  })
}

// the second argument's own keys, so a nested object that happens to hold an
// `init` of its own (a fetch RequestInit, say) is not read as this one
const NESTED_INIT = /\baddView\(\s*[^,]+,\s*\{[^{}]*\binit\s*[,:}]/

test('no launcher nests a view snapshot under init', () => {
  const offenders = ROOTS.flatMap(root => walk(path.join(repo, root)))
    .filter(file => NESTED_INIT.test(readFileSync(file, 'utf8')))
    .map(file => path.relative(repo, file))
  expect(offenders).toEqual([])
})
