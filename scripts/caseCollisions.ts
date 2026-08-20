// Two source files whose paths differ only by case, which is one file on macOS
// and Windows. The reporting half is `check-case-collisions.ts`; this is the
// decision, so it is testable against a path list rather than against a
// checkout — and testing it against a checkout is not an option worth having,
// since building the fixture means writing a case-variant path, which on the
// filesystem this exists for silently addresses the file already there.

// What tsc (and bundlers) compile to a shared output name. Extension-blind
// beyond this set on purpose: a `.md` twin is a checkout hazard rather than a
// build one, and `git ls-files` already refuses to create the pair.
const COMPILED = /\.(?:[cm]?tsx?|[cm]?jsx?)$/

/**
 * Groups of paths that fold to one name, each group sorted, the groups in first
 * -appearance order. Empty when there are none.
 *
 * THE WHOLE PATH IS FOLDED, not the basename: `src/Util/x.ts` and
 * `src/util/x.ts` are the same collision as `x.ts` and `X.ts`, and a
 * basename-only fold would miss it. That is not hypothetical — the directory
 * form is the one that also makes `rm -rf` on the wrong spelling take the other
 * directory with it.
 *
 * The extension is stripped before folding because the collision is between
 * OUTPUTS: `foo.ts` and `Foo.tsx` are distinct inputs that name one `foo.js`.
 */
export function findCaseCollisions(paths: readonly string[]) {
  const byFolded = new Map<string, Set<string>>()
  for (const path of paths) {
    if (!COMPILED.test(path)) {
      continue
    }
    const stem = path.replace(COMPILED, '')
    const spellings = byFolded.get(stem.toLowerCase())
    if (spellings) {
      spellings.add(stem)
    } else {
      byFolded.set(stem.toLowerCase(), new Set([stem]))
    }
  }
  return {
    stems: byFolded.size,
    collisions: [...byFolded.values()]
      .filter(spellings => spellings.size > 1)
      .map(spellings => [...spellings].sort()),
  }
}
