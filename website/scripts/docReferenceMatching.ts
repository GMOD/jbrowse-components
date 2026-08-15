// The two bits of `check-doc-imports.ts` that decide what a line even OFFERS to
// be checked: which repo paths it names, and how far a section citation
// stretches when it wraps.
//
// Split out so they can be tested, for the reason `docFenceRegions.ts` was:
// **a validator's failure mode is silence.** Every rule below is a reason to
// skip something, so a rule that over-matches does not report a false
// positive — it quietly stops checking a class of reference, and the run keeps
// saying "all references resolve". That is how a citation that wrapped between
// its filename and its § went unchecked long enough for the heading it named to
// be reworded, and how three roots' worth of paths went unchecked entirely.
//
// The tests pin the skips as behaviour, so widening one has to be deliberate.

// Repo file-path references in prose (e.g. `packages/core/src/gpu`).
//
// The leading lookbehind is what makes the single-segment roots safe. Without it
// `scripts/…` matches inside `~/src/jb2bench/scripts/render/multibam.ts`, and
// these docs cite sibling repos — a benchmark harness, the graph plugin — often
// enough that the check would report more foreign paths than local ones.
export const REPO_PATH =
  /(?<![A-Za-z0-9_./~-])(?:packages|plugins|products|example-plugins|component_tests|agent-docs|website|scripts|test_data)\/[A-Za-z0-9_./-]+/g

// Anchors whose first segment is a directory OF packages, so the anchor that
// has to exist is two segments deep. A single-segment root (`scripts`,
// `website`, `test_data`) is itself the anchor.
const ANCHORED = new Set([
  'packages',
  'plugins',
  'products',
  'example-plugins',
  'component_tests',
])

export function anchorOf(p: string) {
  const segs = p.split('/')
  return ANCHORED.has(segs[0]!) ? segs.slice(0, 2).join('/') : segs[0]!
}

/**
 * Every repo path a line offers for checking, already stripped of the ones that
 * were never meant to resolve. Returns the cleaned refs; the caller decides
 * whether each exists.
 */
export function repoPathRefs(line: string): string[] {
  const refs: string[] = []
  for (const match of line.matchAll(REPO_PATH)) {
    // `.../` is an explicit abbreviation marker, not a literal path segment.
    if (match[0].includes('...')) {
      continue
    }
    // A glob, a brace expansion or an angle-bracket placeholder stands for a
    // set of files rather than one, and none of those metacharacters is in the
    // path class above — so the match stops at it and what is left is a prefix
    // that was never meant to resolve (`scripts/build_` out of
    // `scripts/build_*.sh`). Look at what the match ran INTO rather than
    // widening the class, which would have to admit the comma inside
    // `specs/graph-{fixtures,ecoli,hprc}.ts` and would then swallow the next
    // word of any sentence listing two paths.
    //
    // This is the path-side counterpart of PLACEHOLDER on the symbol side, and
    // it is what a single-segment root needs: a two-segment placeholder
    // (`plugins/myplugin/…`) already passes on its anchor not existing, but
    // `scripts/…` is anchored on a directory that always exists, so a
    // placeholder under one has to announce itself.
    if ('*{<'.includes(line[match.index + match[0].length] ?? '')) {
      continue
    }
    // A path embedded in a GitHub blob URL is owned by scanBlobAnchors (which
    // also validates its anchor); skip it here so it isn't reported twice.
    if (/\/blob\/[^/]+\/$/.test(line.slice(0, match.index))) {
      continue
    }
    // A path inside `git show <rev>:<path>` names a file at that revision, and
    // the interesting ones are precisely the deleted files a doc points at
    // because they no longer exist — an ADR a later commit removed, say.
    // Resolving it against the worktree asks the wrong question, and the
    // alternative is to stop citing the reasoning behind a decision once its
    // file is gone.
    if (/git show \S*:$/.test(line.slice(0, match.index))) {
      continue
    }
    refs.push(match[0].replace(/[./]+$/, ''))
  }
  return refs
}

// Strip a leading comment marker, so one path serves prose and comments. A
// no-op on a prose line.
const strip = (l: string) => l.replace(/^\s*(\/\/|\*|\/\*\*?)\s?/, '')

/**
 * The text a section citation on `lines[i]` should be matched against.
 *
 * A citation wraps in two places — inside the quoted title, or between the
 * filename and the § — and joining only on the first was the bug: agent-docs is
 * in `.prettierignore` and hand-wrapped at 80 columns, so the second break is
 * the common one for any citation naming a path and a title of more than a few
 * words. An unmatched citation is not reported, it is skipped, so the effect was
 * a checker that silently declined to check its most typical input.
 *
 * Only joins when this line cannot already carry a whole citation, so a
 * single-line hit is not matched twice.
 */
export function citationText(lines: string[], i: number) {
  const line = lines[i] ?? ''
  return /(?:§\s*"[^"]*|\.md\s*)$/.test(line)
    ? `${strip(line)} ${strip(lines[i + 1] ?? '')}`
    : line
}
