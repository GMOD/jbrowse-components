// Every segment of a documented menu path has to be a string the app actually
// renders.
//
// check-menu-paths.ts polices how a path is *spelled* (the `→` separator). This
// one polices whether the labels in it still *exist*: a renamed menu item leaves
// every page that walks a reader to it quietly wrong, and someone hunting for
// "Sort/cluster by..." in a menu that now says "Clustering" has no way to tell
// the docs are stale rather than their own eyes. Four such labels were found by
// hand in Aug 2026; this is what keeps them found.
//
// Scoped to `**A → B**` paths on purpose. A single bold label is usually prose
// emphasis, and enforcing those needs enough heuristics (headings ending in `:`,
// `TL;DR:`, data values) to cost more than it catches — measured at ~9%
// unresolved against ~1% here. The arrow is what makes the intent explicit.
//
// Matching is **exact on the normalized label**, deliberately. The first cut
// also matched templated labels (`Consequence impact${suffix}`) by turning the
// `${...}` hole into `.*`, which is how you get `^b.*d$` — a pattern that
// matches "bubble spread" and 350 other things. That made the check pass on
// labels this repo does not contain at all, which is worse than not having it:
// a vacuous check reads as a guarantee. Every templated label that appears in a
// documented path also exists somewhere as a plain literal, so exact matching
// costs nothing real.
//
// Run: `pnpm check-menu-labels`, or the root `pnpm check-docs`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems, walkFiles } from './check-utils.ts'

const root = join(import.meta.dirname, '..', '..')
const docsDir = join(import.meta.dirname, '..', 'docs')
const GENERATED_PREFIXES = ['config/', 'models/', 'api/']
const SUPPRESS = '<!-- menu-path-ok -->'

// Pages whose subject plugin is not in this repo, so none of their labels can
// resolve here. A page-level fact, kept in one place rather than as a
// suppression comment on each of the ~15 paths they contain.
//
// Every entry is asserted to exist below. An exemption list is the one part of
// a check that can rot without anyone hearing about it: rename the page and the
// entry silently stops applying to anything, and the page it now names — none —
// goes unchecked forever. Same reason spec-recipe-unmapped.txt is a checked-in
// list of names rather than a count.
const EXTERNAL_PLUGIN_PAGES = new Set([
  'user_guides/graph_genome_view.md',
  'tutorials/pangenome_ecoli.md',
  'tutorials/pangenome_hprc.md',
  'tutorials/protein_structure.md',
])

// Prose names for an affordance rather than labels the app renders: the docs
// write "**Track menu → Filter by...**" to say *where* to click, and no string
// in the source says "Track menu". Only ever the first segment. Listed instead
// of left to chance — most of them (`Add`, `File`, `Tools`) do match some
// unrelated literal somewhere and were passing by accident, which is not the
// same as being checked.
const STRUCTURAL_MENU_NAMES = new Set([
  'track menu',
  'view menu',
  'file',
  'tools',
  'add',
  'launch',
  'launch view',
  'help',
])

// A menu label is short. The cap also stops a stray `**` pairing with one far
// down the page and swallowing a whole section as a single "path".
const MAX_SEGMENT = 60
const MAX_PATH = 160

function sourceLabels() {
  const labels = new Set<string>()
  const add = (raw: string) => {
    const t = raw
      .replaceAll('&apos;', "'")
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&')
      // JSX splits a label across `{' '}` to stop the formatter eating the space
      .replaceAll(/\{'\s*'\}/g, ' ')
      .replaceAll(/\s+/g, ' ')
      .trim()
    if (t.length >= 3) {
      labels.add(t)
    }
  }
  for (const dir of ['plugins', 'products', 'packages']) {
    for (const file of walkFiles(
      join(root, dir),
      name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name),
    )) {
      const txt = readFileSync(file, 'utf8')
      for (const m of txt.matchAll(
        /(['"`])((?:(?!\1)[^\\\r\n]|\\.){2,90})\1/g,
      )) {
        add(m[2]!)
      }
      // JSX text nodes: >Some Label<
      for (const m of txt.matchAll(/>\s*([A-Z][^<>]{2,90}?)\s*</g)) {
        add(m[1]!)
      }
    }
  }
  return labels
}

// Case, trailing ellipsis and punctuation all vary between a label and the prose
// that names it; the words do not.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replaceAll(/\.\.\.|…/g, '')
    .replaceAll(/[^a-z0-9 ]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

const normSet = new Set([...sourceLabels()].map(norm))
const resolves = (segment: string) => {
  const n = norm(segment)
  return n === '' || normSet.has(n)
}

const errorLines: string[] = []
const seenPages = new Set<string>()
for (const file of walkFiles(
  docsDir,
  name => name.endsWith('.md') && name !== 'CLAUDE.md',
)) {
  const rel = file.slice(docsDir.length + 1)
  seenPages.add(rel)
  if (
    GENERATED_PREFIXES.some(p => rel.startsWith(p)) ||
    EXTERNAL_PLUGIN_PAGES.has(rel)
  ) {
    continue
  }
  // Paths wrap at 80 columns, so match over a joined paragraph and report the
  // paragraph's first line.
  const lines = readFileSync(file, 'utf8').split('\n')
  let para: string[] = []
  let paraStart = 0
  let inFence = false
  const flush = () => {
    if (para.length === 0) {
      return
    }
    const text = para.join(' ')
    if (!para.some(l => l.includes(SUPPRESS))) {
      // Pair the `**` delimiters in order: in `**A** x→y **B**` the run between
      // A and B is prose, not a third bold span, and a `**…→…**` regex happily
      // matches it. Splitting puts bold content on the odd indices, which is the
      // only reading that survives a page using `→` in prose (maf_track's
      // "red→grey→blue ramp" sits exactly there).
      const bold = text.split('**').filter((_, i) => i % 2 === 1)
      for (const raw of bold) {
        if (!raw.includes('→')) {
          continue
        }
        const segments = raw
          .split('→')
          .map(s => s.trim().replaceAll(/^[`"']|[`"']$/g, ''))
          .filter(s => /[A-Za-z]/.test(s))
        if (
          raw.length > MAX_PATH ||
          segments.length < 2 ||
          segments.some(s => s.length > MAX_SEGMENT)
        ) {
          continue
        }
        const missing = segments.filter(
          (s, i) =>
            !(i === 0 && STRUCTURAL_MENU_NAMES.has(norm(s))) && !resolves(s),
        )
        if (missing.length > 0) {
          errorLines.push(
            `  ${rel}:${paraStart} — no source renders ${missing
              .map(s => JSON.stringify(s))
              .join(', ')}\n      in **${raw.trim()}**`,
          )
        }
      }
    }
    para = []
  }
  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      inFence = !inFence
      flush()
      return
    }
    if (inFence || line.trim() === '') {
      flush()
      return
    }
    if (para.length === 0) {
      paraStart = i + 1
    }
    para.push(line.trim())
  })
  flush()
}

for (const page of EXTERNAL_PLUGIN_PAGES) {
  if (!seenPages.has(page)) {
    errorLines.push(
      `  EXTERNAL_PLUGIN_PAGES names ${JSON.stringify(page)}, which no longer exists.\n      Drop it, or point it at the page's new path.`,
    )
  }
}

reportProblems(
  errorLines.length > 0
    ? [
        `Found ${errorLines.length} problem(s) in documented menu paths:\n`,
        ...errorLines,
        `\nFor a label the source no longer renders, rename it in the docs to match.`,
        `If it belongs to a plugin outside this repo, add the page to`,
        `EXTERNAL_PLUGIN_PAGES, or add ${SUPPRESS} to the line for a one-off.`,
      ]
    : [],
  'All menu-path labels resolve to a string the app renders.',
)
