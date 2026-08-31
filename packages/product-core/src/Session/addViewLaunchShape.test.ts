import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// `addView(type, snapshot)` takes the one authoring shape a view has: every
// setting written directly on the snapshot. v5 still unwraps `init`, so a
// launcher that nests works and warns — and its own tests cannot tell, because
// the view comes out the same either way. This is what keeps the deprecated
// spelling out of the tree while it is still read.
//
// Four launchers wrote it (grid-bookmark's bookmark navigation, maf's
// open-sample and row-synteny, the synteny mate opener) plus jbrowse-img's
// per-mode builder.
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

// The keys of the object literal starting at `open`, one nesting level only —
// a `${}` in a template literal and a nested snapshot both push depth, so
// neither is read as a key of this object.
function topLevelKeys(source: string, open: number) {
  const keys: string[] = []
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const c = source[i]!
    if ('{(['.includes(c)) {
      depth++
    } else if ('})]'.includes(c)) {
      depth--
      if (depth === 0) {
        return keys
      }
    } else if (depth === 1 && /[A-Za-z_]/.test(c)) {
      const word = /^\w+/.exec(source.slice(i))![0]
      if (/^\s*[,:}]/.test(source.slice(i + word.length))) {
        keys.push(word)
      }
      i += word.length - 1
    }
  }
  return keys
}

function nestsInit(source: string) {
  for (const m of source.matchAll(/\baddView\([^,)]+,\s*(?=\{)/g)) {
    if (topLevelKeys(source, m.index + m[0].length).includes('init')) {
      return true
    }
  }
  return false
}

test('no launcher nests a view snapshot under init', () => {
  const offenders = ROOTS.flatMap(root => walk(path.join(repo, root)))
    .filter(file => nestsInit(readFileSync(file, 'utf8')))
    .map(file => path.relative(repo, file))
  expect(offenders).toEqual([])
})
