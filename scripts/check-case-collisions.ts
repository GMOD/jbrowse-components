// Two source files in one directory whose names differ only by case.
//
// WHY THIS IS A CHECK AND NOT A NOTE. tsc emits `X.d.ts` and `X.js` from `X.ts`
// and from `X.tsx` alike, so a `foo.ts` beside a `Foo.tsx` names one output
// path. On a case-SENSITIVE filesystem that is two files and CI is green; on
// macOS and Windows it is one, and whichever compiles second wins. `build:esm`
// then fails with TS5056 ("would be overwritten by multiple input files") on a
// clean tree — and, far worse, with a stale `esm/` it fails with a cascade of
// TS6305 and TS7006 naming files that are perfectly fine, because every
// consumer is reading a `.d.ts` built from the other twin.
//
// `pnpm typecheck` cannot see any of it: `--noEmit` writes no output, so there
// is nothing to collide. That is the whole gap — a pair can land green by every
// gate an author runs and break the build for everyone on a case-insensitive
// checkout. Three pairs were live at once on 2026-08-20 (`menuItems.ts` /
// `MenuItems.tsx`, `scoreRules.ts` / `ScoreRules.tsx`, `derivativePathStrip.ts`
// / `DerivativePathStrip.tsx`), and the build had been red long enough that its
// errors read as ordinary staleness.
//
// Test files are included even though the ESM build excludes them: the pair is
// just as confusing to a reader and to an editor's file switcher, and the same
// rename fixes it.

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// What tsc (and bundlers) compile to a shared output name.
const COMPILED = /\.(?:[cm]?tsx?|[cm]?jsx?)$/

const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 1 << 28,
})
  .split('\0')
  .filter(Boolean)

// dir + lowercased stem -> the spellings actually on disk
const byFoldedStem = new Map<string, Set<string>>()
for (const path of tracked) {
  if (!COMPILED.test(path)) {
    continue
  }
  const stem = path.replace(COMPILED, '')
  const spellings = byFoldedStem.get(stem.toLowerCase())
  if (spellings) {
    spellings.add(stem)
  } else {
    byFoldedStem.set(stem.toLowerCase(), new Set([stem]))
  }
}

const collisions = [...byFoldedStem.values()]
  .filter(spellings => spellings.size > 1)
  .map(spellings => [...spellings].sort())

if (collisions.length > 0) {
  console.error(
    `\n${collisions.length} module name(s) differing only by case:\n${collisions
      .map(spellings => `  ${spellings.join('  <->  ')}`)
      .join(
        '\n',
      )}\n\nEach pair emits to one path on a case-insensitive filesystem. Rename one\nside — the published subpath, if either is one, is the side that must keep its\nname (reference/PLUGIN_ABI_STABILITY.md).`,
  )
  process.exit(1)
}

console.log(
  `${byFoldedStem.size} compiled module name(s); none differ only by case`,
)
