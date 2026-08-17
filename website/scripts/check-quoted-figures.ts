// Every figure a measurement page quotes in prose has to exist in a source this
// repo keeps.
//
// `sync-measurements` gates the TABLES on such a page. The prose around them is
// the other half and the larger one: "28% of the cold query", "1.83x on the part
// the pool can reach", "70-90% of its wall clock". Each of those was copied out
// of an `agent-docs/` doc or a JSDoc by hand, and copied numbers rot in exactly
// one direction — the source gets re-measured, the published page does not.
//
// So: pull every `<number><unit>` out of a page's prose and require the same
// figure to appear in something the page CITES — an `agent-docs/` doc it links,
// or the JSDoc of a symbol it names. That is a weaker claim than "this number is
// right" and it is the strongest one a checker can make cheaply, because it
// catches the two failures that actually happen — a figure invented or
// fat-fingered on the way in, and a figure left behind when its source moved.
//
// ## Scope is self-declaring
//
// A page is in scope when it carries a `BEGIN GENERATED MEASUREMENT` block:
// having one is a page saying it publishes measurements. Nothing has to be
// registered, and a new page joins by doing the thing that makes it a
// measurement page in the first place.
//
// ## What counts as a figure
//
// A number with a unit, and nothing else. Bare integers are prose ("three
// clocks", "one call", "both arms") and matching them reports the English
// language. Version numbers, dates and anchor fragments are excluded by the
// same rule, since none of them carries one of these units.
//
// Ranges (`70-90%`, `1.13-1.24x`) are two figures sharing a unit, and both ends
// are checked. `quotedFigures.test.ts` pins that, because it was false
// for as long as this comment claimed it: the first number of a range is
// followed by `-` rather than a unit, so the original pattern silently matched
// only the upper end and `17-90%` passed.
//
// ## What it does not catch, stated plainly
//
// This is an existence check, so a figure passes when its VALUE occurs in a
// cited file, whatever that file was talking about. Two figures that collide by
// coincidence are indistinguishable here, and the defence is scope, not
// cleverness: both haystacks are the ones the page itself points a reader at.
//
// Scope is worth stating in numbers, since "narrow" is the kind of claim that
// rots. Against the whole repo the source side admitted **73 of the 101 integer
// percentages**, i.e. most typos; the page's own cited docs and exported symbols
// admit 23. So a mistyped `28%` is likelier to fail than not, and a distinctive
// figure — `12.5ms`, `149,307`, `1.17GB` — is effectively pinned. A figure that
// collides anyway is one a reader could at least trace, which is the property
// this file is really defending.
//
// The failure it catches best is the one the first real run found: three
// sections quoting figures from `agent-docs` docs the page never linked, and two
// more restating a number derived from a table on the page — a published figure
// with no route back to a measurement, which is worse than a stale one.
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  BUILD_DIRS,
  docFiles,
  reportProblems,
  walkFiles,
} from './check-utils.ts'
import { FENCE } from './docFenceRegions.ts'
import { docsDir, repoRoot } from './paths.ts'
import { figuresIn } from './quotedFigures.ts'

const MEASUREMENT_PAGE = /<!--\s*BEGIN GENERATED MEASUREMENT\s+[\w-]+\s*-->/
const GENERATED_START = /^<!--\s*BEGIN GENERATED\b[^>]*-->$/
const GENERATED_END = /^<!--\s*END GENERATED\b[^>]*-->$/

/**
 * A page's prose: no frontmatter, no code fences, no generated blocks, no link
 * targets.
 *
 * Link targets are dropped because a URL is full of digits that are not figures
 * — a commit sha, an anchor a heading slugified, `adr-022`. Their *text* stays,
 * since that is prose a reader reads.
 */
function proseOf(text: string) {
  const out: string[] = []
  let inFence = false
  let inGenerated = false
  let inFrontmatter = false
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim()
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true
      return
    }
    if (inFrontmatter) {
      inFrontmatter = trimmed !== '---'
      return
    }
    if (FENCE.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) {
      return
    }
    if (GENERATED_START.test(trimmed)) {
      inGenerated = true
      return
    }
    if (GENERATED_END.test(trimmed)) {
      inGenerated = false
      return
    }
    if (inGenerated) {
      return
    }
    out.push(line.replaceAll(/\]\([^)]*\)/g, ']').replaceAll(/`[^`]*`/g, '``'))
  })
  return out.join('\n')
}

// What a file declares that a page could cite: its EXPORTS, plus the basename,
// since a page names `bgzfWorkerPool.ts` as often as the function inside it.
//
// Exported only. Indexing every top-level binding sounds stricter and is not: a
// page saying "the pool spends 70% here" names `data`, `size`, `time` and `to`
// somewhere in its own code spans, and each of those is a local `const` in a
// hundred files, so the index hands back every figure in the repo under a name
// no reader would follow. Measured on this page, local bindings admitted 50 of
// the 101 integer percentages against 23 for exports alone.
const DECLARATION =
  /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g

/**
 * Figures recorded in a JSDoc, indexed by the symbol whose definition carries
 * them.
 *
 * A handful of figures live at the definition site instead of in a doc —
 * `bgzfWorkerPool.ts` carries the 1.95x and the bundle numbers behind its own
 * dynamic import, and that is the right home for them, since the next person to
 * consider a static import reads that comment and not a doc.
 *
 * Indexed by symbol rather than pooled repo-wide, for the reason the doc side is
 * scoped to the docs a page links. Pooled, this side accepted **73 of the 101
 * integer percentages** — a mistyped `28%` finds a `29%` in an unrelated sashimi
 * comment and passes, and so does almost any other typo. "A page cites source by
 * symbol and not by path" was the stated reason for going wide; indexing by the
 * declared symbol is that sentence implemented, and it gives a reader the same
 * route back a linked doc does.
 */
function sourceFiguresBySymbol() {
  const bySymbol = new Map<string, Set<string>>()
  const isSource = (name: string) => /\.(tsx?|jsx?|mjs|cjs|slang)$/.test(name)
  // Not `scripts/` or `website/scripts/`. A build script is thick with
  // incidental numbers — sample output pasted into a comment, DPI constants,
  // percentages in a worked example — and none of it is a measurement anyone
  // would quote.
  for (const base of ['packages', 'plugins', 'products']) {
    for (const file of walkFiles(join(repoRoot, base), isSource, BUILD_DIRS)) {
      const text = readFileSync(file, 'utf8')
      const keys = new Set(figuresIn(text).keys())
      if (keys.size === 0) {
        continue
      }
      const names = [...text.matchAll(DECLARATION)].map(m => m[1]!)
      names.push(
        file
          .split('/')
          .pop()!
          .replace(/\.\w+$/, ''),
      )
      for (const name of names) {
        let set = bySymbol.get(name)
        if (!set) {
          set = new Set()
          bySymbol.set(name, set)
        }
        for (const key of keys) {
          set.add(key)
        }
      }
    }
  }
  return bySymbol
}

// A symbol the page names in backticks. `proseOf` strips code spans before the
// figures are pulled, so this reads the page as written, not the prose.
const CODE_SPAN = /`([^`]+)`/g
const IDENTIFIER = /[A-Za-z_$][\w$]*/g

function citedSourceFigures(text: string, bySymbol: Map<string, Set<string>>) {
  const set = new Set<string>()
  for (const span of text.matchAll(CODE_SPAN)) {
    for (const id of span[1]!.matchAll(IDENTIFIER)) {
      for (const key of bySymbol.get(id[0]) ?? []) {
        set.add(key)
      }
    }
  }
  return set
}

// An agent-doc the page links to, in either of the two forms a website page can
// write one.
const AGENT_DOC_LINK = /(?:blob\/main\/|\]\(\/?)(agent-docs\/[\w./-]+\.md)/g

/**
 * Figures recorded in the agent-docs this page itself cites.
 *
 * Scoped to the cited docs rather than to all of `agent-docs/`, because the
 * whole tree is a big enough haystack that a common value finds a match by
 * coincidence — `29%` occurs in a doc about something else entirely, so
 * mistyping `28%` passed. Narrowing to what the page links makes the check ask
 * the question a reader would: is this figure in the doc you sent me to?
 *
 * A page that quotes a doc it does not link is the same defect one step
 * earlier, and fails here — which is the right answer, since a figure with no
 * route back to its source is what this file exists to stop.
 */
function citedDocFigures(text: string) {
  const set = new Set<string>()
  for (const m of text.matchAll(AGENT_DOC_LINK)) {
    let contents
    try {
      contents = readFileSync(join(repoRoot, m[1]!), 'utf8')
    } catch {
      // check-doc-imports owns "this link resolves"; reporting it here too
      // would put the same broken link in two failures.
      continue
    }
    for (const key of figuresIn(contents).keys()) {
      set.add(key)
    }
  }
  return set
}

// A figure whose source is another repo. Each entry names the doc that owns it,
// because the point of the list is that somebody can go and check. Keep it
// short: a figure we cannot gate is one a reader cannot trace either, and the
// better fix is usually to describe the mechanism and link out.
const OWNED_ELSEWHERE = new Map([
  // bgzf-filehandle/docs/optimizations.md, "Why not the platform's
  // DecompressionStream?" — libdeflate-in-wasm against a per-block JS inflate.
  ['2.6x', '@gmod/bgzf-filehandle'],
  ['3.5x', '@gmod/bgzf-filehandle'],
])

const bySymbol = sourceFiguresBySymbol()
const problems: string[] = []
let pages = 0
let checked = 0

for (const path of docFiles(docsDir)) {
  const text = readFileSync(path, 'utf8')
  if (!MEASUREMENT_PAGE.test(text)) {
    continue
  }
  pages++
  const cited = citedDocFigures(text)
  const citedSource = citedSourceFigures(text, bySymbol)
  for (const [key, written] of figuresIn(proseOf(text))) {
    checked++
    if (cited.has(key) || citedSource.has(key) || OWNED_ELSEWHERE.has(key)) {
      continue
    }
    problems.push(
      `  ${relative(repoRoot, path)}: "${written}" is in no agent-doc this page links ` +
        'and in no symbol it names — link the doc that records the figure, name the ' +
        'symbol whose JSDoc does, or record the measurement first',
    )
  }
}

if (pages === 0) {
  console.error('no measurement pages found — did the marker spelling change?')
  process.exit(1)
}

reportProblems(
  problems,
  `${checked} quoted figure(s) across ${pages} measurement page(s) all trace to a recorded measurement`,
)
