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
// figure to appear somewhere in `agent-docs/` or in source. That is a weaker
// claim than "this number is right" and it is the strongest one a checker can
// make cheaply, because it catches the two failures that actually happen — a
// figure invented or fat-fingered on the way in, and a figure left behind when
// its source moved.
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
// Ranges (`70-90%`, `1.13-1.24x`) are matched end by end and both ends checked
// separately, so `2.6-3.5x` needs the source to spell both — which it does,
// because a range in a doc is a range in the measurement.
//
// ## What it does not catch, stated plainly
//
// This is an existence check, so a figure passes when its VALUE occurs in a
// searched file, whatever that file was talking about. Distinctive figures —
// `1.83x`, `12.5ms`, `149,307`, `1.17GB` — are effectively pinned, and they are
// most of what a page like this quotes. Round ones are not: mistyping `28%` as
// `29%` still passes here, because a comment in an unrelated sashimi file
// happens to say `29%`. Narrowing the doc side to the docs the page links (see
// `citedDocFigures`) closed most of that window; the source side stays
// repo-wide because a page cites source by symbol and not by path.
//
// The two failures it does catch are the two that happen. Sabotaging the page
// found both, and the first real run found something better than either: two
// sections quoting figures from `agent-docs` docs the page never linked, which
// is a figure a reader has no route back to.
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

const MEASUREMENT_PAGE = /<!--\s*BEGIN GENERATED MEASUREMENT\s+[\w-]+\s*-->/
const GENERATED_START = /^<!--\s*BEGIN GENERATED\b[^>]*-->$/
const GENERATED_END = /^<!--\s*END GENERATED\b[^>]*-->$/

// A number, optionally with thousands separators or a decimal, followed by a
// unit. The unit list is deliberately closed: an open one ("any word") matches
// "5 workers" and "3 rows", which are counts the prose owns rather than figures
// it quotes.
const UNITS = [
  'x',
  '%',
  'ms',
  's',
  'KB',
  'MB',
  'GB',
  'KiB',
  'MiB',
  'GiB',
  'kb',
  'Mb',
  'Gb',
  'bp',
  'Gbp',
  'Mbp',
  'kbp',
]
const FIGURE = new RegExp(
  String.raw`(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s?(${UNITS.join('|')})(?![\w])`,
  'g',
)

/** `1,234.5 MB` and `1234.5MB` are the same figure written twice. */
function normalize(value: string, unit: string) {
  return `${value.replaceAll(',', '')}${unit.toLowerCase()}`
}

function figuresIn(text: string) {
  const found = new Map<string, string>()
  for (const m of text.matchAll(FIGURE)) {
    // The `\s?` between number and unit matches the newline a wrapped
    // paragraph puts there, so the text as written can span two lines. Collapse
    // it for the report — a failure quoting `"80\nKiB"` reads as a checker bug.
    found.set(normalize(m[1]!, m[2]!), m[0].replaceAll(/\s+/g, ' '))
  }
  return found
}

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

/**
 * Figures recorded in source.
 *
 * A handful live in a JSDoc at the definition site instead of in a doc —
 * `bgzfWorkerPool.ts` carries the 1.95x and the bundle numbers behind its own
 * dynamic import, and that is the right home for them, since the next person to
 * consider a static import reads that comment and not a doc.
 */
function sourceFigures() {
  const set = new Set<string>()
  const isSource = (name: string) => /\.(tsx?|jsx?|mjs|cjs|slang)$/.test(name)
  // Not `scripts/` or `website/scripts/`. A build script is thick with
  // incidental numbers — sample output pasted into a comment, DPI constants,
  // percentages in a worked example — and none of it is a measurement anyone
  // would quote, so including it only widens the coincidence window below.
  for (const base of ['packages', 'plugins', 'products']) {
    for (const file of walkFiles(join(repoRoot, base), isSource, BUILD_DIRS)) {
      for (const key of figuresIn(readFileSync(file, 'utf8')).keys()) {
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

const inSource = sourceFigures()
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
  for (const [key, written] of figuresIn(proseOf(text))) {
    checked++
    if (cited.has(key) || inSource.has(key) || OWNED_ELSEWHERE.has(key)) {
      continue
    }
    problems.push(
      `  ${relative(repoRoot, path)}: "${written}" is in none of the agent-docs this page links, ` +
        'and in no source — quote the figure its source records, or record the measurement first',
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
