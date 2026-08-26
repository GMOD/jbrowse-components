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

// A citation names a doc, then a separator, then the heading in quotes. The doc
// half is either a bare path or a markdown link, in which case the LINK TARGET
// is the reference and the label is prose. The separator half is a section mark,
// a comma, or a possessive — the last two were unrecognized until 2026-08-26,
// which is how seven citations of a renamed backlog section stayed green.
//
// A comma is loose enough to match a sentence that happens to quote something
// after naming a doc. That is the intended trade: this repo's convention is that
// a quoted title after a doc reference IS a citation, so a false positive here
// is a sentence to rephrase, while the alternative was not checking the form
// most citations are actually written in.
export const SECTION_CITE =
  /(?:\[[^\]]*\]\(\s*([\w./-]*\.md)(?:#[^)]*)?\s*\)|([\w./-]*\.md)`?)\s*(?:§|,|['’]s)\s*"([^"]+)"/g

// Strip a leading comment marker, so one path serves prose and comments. A
// no-op on a prose line.
const strip = (l: string) => l.replace(/^\s*(\/\/|\*|\/\*\*?)\s?/, '')

/**
 * The text a section citation on `lines[i]` should be matched against.
 *
 * A citation wraps in two places — inside the quoted title, or between the
 * filename and the separator — and joining only on the first was the bug:
 * agent-docs is in `.prettierignore` and hand-wrapped at 80 columns, so the
 * second break is the common one for any citation naming a path and a title of
 * more than a few words. An unmatched citation is not reported, it is skipped,
 * so the effect was a checker that silently declined to check its most typical
 * input.
 *
 * Both halves are per-separator, and each stayed section-mark-only after
 * `SECTION_CITE` learned the other two: a comma citation that wrapped inside its
 * title went unchecked for the same reason a section-mark one used to.
 *
 * Joining more lines than needed is safe in a way missing one is not. The joined
 * text is only ever fed back to `SECTION_CITE`, which still demands a `.md`
 * before the separator, so a prose comma before a quote joins a line and matches
 * nothing.
 *
 * Only joins when this line cannot already carry a whole citation, so a
 * single-line hit is not matched twice.
 */
export function citationText(lines: string[], i: number) {
  const line = lines[i] ?? ''
  return /(?:(?:§|,|['’]s)\s*"[^"]*|\.md`?\)?\s*(?:§|,|['’]s)?\s*)$/.test(line)
    ? `${strip(line)} ${strip(lines[i + 1] ?? '')}`
    : line
}

/**
 * The doc-and-heading pairs a line cites by quoted title.
 *
 * `§` was the only separator this recognized, and the citations that drifted
 * furthest used the other two. A bulk move of 34 backlog entries out of
 * `TODO.md` on 2026-08-26 left seven citations naming headings that no longer
 * existed, every one of them written as a comma or a possessive, so check 6
 * skipped all seven while reporting that citations resolve. The forms are
 * spelled out in the tests rather than here: this file is inside the scan, so a
 * literal citation in a comment is one the checker then has to resolve.
 *
 * The markdown-link form is the same gap one level down — a link carrying a
 * section mark still escaped, because the `)` sits between the filename and the
 * separator. A link's target is the reference; its label is prose and may say
 * anything.
 */
export function sectionCites(text: string) {
  const cites: { ref: string; title: string }[] = []
  for (const m of text.matchAll(SECTION_CITE)) {
    cites.push({ ref: m[1] ?? m[2]!, title: m[3]! })
  }
  return cites
}

/**
 * How loosely a cited title is matched against the text it names.
 *
 * Case, backticks and `*` emphasis are noise a citation reasonably drops, as the
 * one naming "The same disease rots the docs" does for a heading that
 * italicizes *docs*. Underscores are left alone — in these docs they appear in
 * identifiers, not as emphasis.
 *
 * Quote marks go with them, and that one is structural rather than a courtesy: a
 * citation is delimited by double quotes, so a target containing one cannot be
 * quoted literally at all, and every citation of the one about a display
 * asserting its own did-we-paint respells it with single quotes.
 */
export function normalizeHeading(s: string) {
  return s
    .toLowerCase()
    .replaceAll(/[`*"'‘’“”]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

// A `#` heading, and a bolded lead-in opening a paragraph or a list item.
//
// The lead runs to its closing `**` and the rest of the line is the paragraph it
// opens, so only the heading half is anchored at the end.
//
// A lead may run past its own line — agent-docs is hand-wrapped at 80 columns
// and a lead of more than a dozen words wraps like anything else — so the bold
// span crosses newlines. It is bounded rather than open-ended because an
// unbalanced `**` would otherwise swallow the rest of the file and answer to
// every citation in it; a name longer than this is not one anybody quotes.
const HEADING = /^#{1,6}[ \t]+(.*?)[ \t]*#*[ \t]*$/gm
const BOLD_LEAD = /^[ \t]*(?:[-*+][ \t]+)?\*\*([\s\S]{1,200}?)\*\*/gm

/**
 * Every piece of a doc a citation may name, normalized.
 *
 * Headings alone counted, and that put the citations most worth checking out of
 * reach of the check: REJECTED_IDEAS.md holds 155 entries and not one heading
 * among them, so the two dozen source comments saying "this was declined, here
 * is where" named text the checker could never find — and the same went for
 * every doc marking a sub-point with a bolded lead rather than a fourth-level
 * heading. Seven live citations resolved the moment the lead-ins joined.
 *
 * Matching is by PREFIX at the call site, so a citation may quote a stable
 * opening of a longer target and drop a trailing period. It has to quote from
 * the START of one: a phrase lifted out of the middle of a lead is not a name,
 * and the two that did were both citations of something the doc had stopped
 * saying anyway.
 */
export function citableTargets(text: string) {
  const targets: string[] = []
  for (const re of [HEADING, BOLD_LEAD]) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      targets.push(normalizeHeading(m[1]!))
    }
  }
  return targets
}
