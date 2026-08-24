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
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docFiles, reportProblems } from './check-utils.ts'
import { norm, sourceLabels } from './menu-label-corpus.ts'
import {
  docRelative,
  docsDir,
  libraryCheckout,
  pluginCheckout,
  repoRoot,
} from './paths.ts'

const GENERATED_PREFIXES = ['config/', 'models/', 'api/']
const SUPPRESS = '<!-- menu-path-ok -->'

// Pages whose subject plugin is not in this repo, mapped to the sibling checkout
// that does render their labels. A page-level fact, kept in one place rather
// than as a suppression comment on each of the ~15 paths they contain.
//
// These used to be a flat exemption set, which made the graph-view pages the
// least-checked prose in the docs and the most exposed to drift: the plugin is
// deployed from its own repo, so a renamed dropdown changes every page that
// walks a reader to it with no commit here to attribute it to. The same sibling
// checkout is already how `specs/graph-fixtures.ts` picks up a locally built bundle, so
// reading its `src/` for label literals adds no dependency that the figure
// pipeline does not already have.
//
// Every entry is asserted below to name a page that exists, and every present
// root is asserted to yield labels. An exemption list is the one part of a check
// that can rot without anyone hearing about it: rename the page and the entry
// silently stops applying to anything, and the page it now names — none — goes
// unchecked forever. Same reason spec-recipe-unmapped.txt is a checked-in list
// of names rather than a count.
const PLUGIN_SRC = (name: string) => join(pluginCheckout(name), 'src')
const LIBRARY_SRC = (name: string, ...rest: string[]) =>
  join(libraryCheckout(name), ...rest)

// A page can name labels from more than one plugin — the proteins page walks
// one right-click menu that protein3d and msaview each contribute a launcher
// to — so this maps a page to every checkout its labels live in, and a page is
// checked against the union.
const EXTERNAL_PLUGIN_PAGES = new Map([
  ['tutorials/alphagenome.md', [PLUGIN_SRC('alphagenome')]],
  ['user_guides/graph_genome_view.md', [PLUGIN_SRC('graphgenomeview')]],
  ['tutorials/pangenome_ecoli.md', [PLUGIN_SRC('graphgenomeview')]],
  ['tutorials/pangenome_hprc.md', [PLUGIN_SRC('graphgenomeview')]],
  ['tutorials/pangenome_cactus.md', [PLUGIN_SRC('graphgenomeview')]],
  [
    'tutorials/genomes_proteins.md',
    [
      PLUGIN_SRC('protein3d'),
      PLUGIN_SRC('msaview'),
      LIBRARY_SRC('react-msaview', 'packages', 'lib', 'src'),
    ],
  ],
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
  // The graph view answers a right-click on a node rather than a menu button,
  // so the docs name the gesture where other pages name a menu.
  'right click a node',
])

// A menu label is short. The cap also stops a stray `**` pairing with one far
// down the page and swallowing a whole section as a single "path".
const MAX_SEGMENT = 60
const MAX_PATH = 160

const REPO_LABELS = new Set(
  [
    ...sourceLabels(
      ['plugins', 'products', 'packages'].map(d => join(repoRoot, d)),
    ),
  ].map(norm),
)

// One extra label set per external checkout that is actually on disk, unioned
// with the repo's. A page that names a plugin item usually also names a core
// one on the way to it (`Track menu → Launch view → Graph genome view (this
// region)`), so neither set alone can answer for a path.
const errorLines: string[] = []
const skippedPages: string[] = []
const externalLabels = new Map<string, Set<string>>()
for (const root of new Set([...EXTERNAL_PLUGIN_PAGES.values()].flat())) {
  if (!existsSync(root)) {
    continue
  }
  const found = sourceLabels([root])
  if (found.size === 0) {
    // The directory is there and holds no label at all, which means it moved
    // rather than that the plugin renders nothing. Silently returning an empty
    // set would fail every path on the page as a rename.
    errorLines.push(
      `  ${root} exists but yields no label literals.\n      Point EXTERNAL_PLUGIN_PAGES at the checkout's source directory.`,
    )
    continue
  }
  externalLabels.set(root, new Set([...REPO_LABELS, ...[...found].map(norm)]))
}

const seenPages = new Set<string>()
for (const file of docFiles(docsDir)) {
  const rel = docRelative(file)
  seenPages.add(rel)
  if (GENERATED_PREFIXES.some(p => rel.startsWith(p))) {
    continue
  }
  const external = EXTERNAL_PLUGIN_PAGES.get(rel)
  // Every named checkout has to be here, not just one: a page whose labels come
  // from two plugins and can only see one would report the other's as renames.
  const missingRoots = external?.filter(root => !externalLabels.has(root))
  const normSet =
    external === undefined
      ? REPO_LABELS
      : missingRoots?.length === 0
        ? new Set(external.flatMap(root => [...externalLabels.get(root)!]))
        : undefined
  if (normSet === undefined) {
    // The checkout this page's labels live in is not here. Skipped rather than
    // passed, and counted, because a check that quietly covers less than it did
    // yesterday is the failure mode this whole file exists to avoid.
    skippedPages.push(`${rel} (needs ${missingRoots?.join(', ')})`)
    continue
  }
  const resolves = (segment: string) => {
    const n = norm(segment)
    return n === '' || normSet.has(n)
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

for (const page of EXTERNAL_PLUGIN_PAGES.keys()) {
  if (!seenPages.has(page)) {
    errorLines.push(
      `  EXTERNAL_PLUGIN_PAGES names ${JSON.stringify(page)}, which no longer exists.\n      Drop it, or point it at the page's new path.`,
    )
  }
}

// Said on a pass as well as a failure. These pages are the ones whose labels
// drift without a commit in this repo, so "checked" and "skipped for want of a
// checkout" have to be told apart at a glance rather than inferred from a
// silence that also means "all good".
if (skippedPages.length > 0) {
  console.log(
    `Skipped ${skippedPages.length} page(s) whose plugin checkout is absent:\n${skippedPages.map(p => `  ${p}`).join('\n')}`,
  )
}

reportProblems(
  errorLines.length > 0
    ? [
        `Found ${errorLines.length} problem(s) in documented menu paths:\n`,
        ...errorLines,
        `\nFor a label the source no longer renders, rename it in the docs to match.`,
        `If it belongs to a plugin outside this repo, map the page to that`,
        `checkout's src/ in EXTERNAL_PLUGIN_PAGES. For a templated label`,
        `(\`Highlight in \${assembly}\`) or a data value that is not a label at`,
        `all, add ${SUPPRESS} to the line.`,
      ]
    : [],
  `All menu-path labels resolve to a string the app renders${
    skippedPages.length > 0 ? ', in the pages that could be checked' : ''
  }.`,
)
