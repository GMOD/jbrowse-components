// Enforce this site's copy-pasteable rule from the other side:
//   node scripts/check-duplication.mjs
//
// Every example here is one complete file, so the same helper is written out in
// up to seven of them (see CLAUDE.md for why that is correct and why factoring
// them into a src/browser/ module would destroy the product). The cost of that
// rule is drift: a fix to the pan handler has to land in five files, and a file
// that gets missed is a page teaching a bug, with nothing to say so.
//
// So the rule gets a check. Two blocks with the same name in two example files
// must be character-identical once comments are stripped — comments are
// deliberately not compared, because a repeated block is supposed to carry a
// one-line pointer to the page that explains it rather than the whole reasoning.
//
// A block that genuinely differs per page goes in DIVERGES below, with the
// reason. That list is short on purpose: if it starts growing, the shared
// surface has outgrown copy-paste and the answer is a different *rule* argued in
// CLAUDE.md, not more entries here.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const examplesDir = path.join(root, 'src', 'examples')

// Names allowed to differ between files, and why. Anything not listed here is
// expected to be identical everywhere it appears.
const DIVERGES = {
  makeView:
    'each page declares its own tracks, start location and return shape',
  trackIds: "the page's own track list",
  featureTrack:
    'the feature-details page gives the genes track more height, being the only track on it; the search pages must additionally point at the hosted trix-indexed copy of the RefSeq GFF3, whose trackId is `genes`, the id the trix index was built against',
  BrowserView:
    'pages with no session alias the view directly; the rest destructure it',
  TrackColumn:
    'the selector page renders the catalogue in its own order and skips what is hidden; the local-file page renders `view.tracks`, which is the order the files were opened -- nothing there can hide a track, so the order cannot shuffle',
  conservationTrack:
    'EveryChromosome stacks it under its own chromosome strip and gives it more height for that layout; every other page uses it as a single quantitative track at the height wiggleTrack used to be',
}

// The other half of the rule, and the one this file was missing.
//
// Checking that the copies are IDENTICAL says nothing about whether they should
// exist, so a green run sat on ~1400 redundant lines and the "publish the block"
// escape hatch in CLAUDE.md only ever fired when somebody happened to look. This
// is the question, asked automatically: a block copied into COPY_THRESHOLD files
// or more has to be listed here with a reason it is the reader's own to write.
//
// Not a line budget. A line budget fails when a page is added, which is not the
// event worth interrupting; introducing a NEW widely-shared block is. The right
// answer to a failure here is usually one of two things, and picking is the
// whole point:
//
//   - the reader would write it themselves anyway (their box, their data, their
//     app's dark-mode wiring) -> add it below, one line, with the reason
//   - the reader would have to write it because JBrowse doesn't publish it ->
//     that is a missing export, not a duplication problem. `usePanZoom` was
//     eight hand-rolled copies, each worse than the one JBrowse already ran.
const COPY_THRESHOLD = 3

const COPIED = {
  viewport:
    "the box the gesture handlers go on, which is the reader's to style — but it is named rather than written inline so that this check can see it at all; `touchAction: 'none'` is the property whose loss is silent (see the note above `blocks`)",
  TrackRow:
    "mounting a display is what the reader came to see, and the box it goes in is theirs to style — see EXAMPLES_SITES.md, 'the one good way out is to publish the block'",
  TrackStack: 'ditto: the reader owns the column their tracks sit in',
  ViewStatus:
    "what a host's loading, error and nothing-navigated box looks like is theirs; deciding which of the four it is showing is not, and that half is published as `view.status`. Without the block three of those states draw nothing — see the Loading and error states page",
  readSiteMode:
    "how a host knows its own colour mode is the host's business; JBrowse's half is useSessionPalette",
  watchSiteMode:
    'ditto, the subscribe half — an embedder subscribes to whatever their own design system publishes, not to a data-theme attribute this site happens to set',
  useSiteMode: "ditto — the watchers are this site's, not an embedder's",
  BrowserSession:
    "the page's own alias for what `createViewState` handed back — one line, and naming it is what keeps every component below from re-deriving it",
  hg38: "the page's own assembly, and bulk data by the fixture rule",
  alignmentsTrack:
    "the page's own track config: seeing the adapter is the point",
  RegionBoundaries:
    "the geometry moved to `view.paddingSpans`, the same getter PaddingBlocks itself reads; what is left is one absolutely-positioned div per span, which is the reader's to place",
  SPAN_FILL:
    "ditto — what a seam, a greyed genome end and an elided region look like is the reader's design system",
}

// Split a file into top-level declaration blocks. A block runs from its `const`
// / `function` / `type` line to the next one (or to `export default`), so any
// leading comment belongs to the block before it — which does not matter, since
// comments are stripped before comparison.
//
// **Only NAMED top-level declarations are visible to this file, and that is the
// blind spot to keep in mind when adding a page.** Repeated JSX written inline
// is invisible: it has no name to group by, so neither the drift check nor
// COPY_THRESHOLD can reach it. That is not hypothetical — the single most
// repeated thing on this site was the pan/zoom container div, spread across 13
// files with its four style properties written out inline in each, and this
// check had never once looked at it. One of those four is
// `touchAction: 'none'`, whose absence costs nothing on a desktop and makes the
// demo inert on a phone with nothing in the console: exactly the silent drift
// the file exists to catch.
//
// So the rule the blind spot implies: **behaviour that repeats gets a name.**
// It is now `viewport`, one `const` per file, and the check covers it. When you
// find yourself pasting a styled div into a fifth example, name it there rather
// than assuming a green run means anything about it.
function blocks(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const starts = []
  lines.forEach((line, i) => {
    if (/^(?:export\s+)?(?:const|function|type)\s+[A-Za-z0-9_]+/.test(line)) {
      starts.push(i)
    }
    // `export default Foo` re-states a name that is already a block above it
    if (/^export default\s/.test(line)) {
      starts.push({ end: i })
    }
  })
  const out = new Map()
  starts.forEach((start, i) => {
    if (typeof start !== 'number') {
      return
    }
    const next = starts[i + 1]
    const end = typeof next === 'number' ? next : (next?.end ?? lines.length)
    const name = /\s([A-Za-z0-9_]+)/.exec(
      lines[start].replace(/^(?:export\s+)?(?:const|function|type)/, ''),
    )?.[1]
    if (name) {
      out.set(name, lines.slice(start, end))
    }
  })
  return out
}

// comments differ by design (each repeat points at the page that explains it),
// so compare code only
function code(lines) {
  return lines
    .filter(l => l.trim() && !/^\s*(?:\/\/|\/\*|\*)/.test(l))
    .join('\n')
    .trimEnd()
}

const byName = new Map()
for (const file of fs
  .readdirSync(examplesDir)
  .filter(f => f.endsWith('.tsx'))) {
  for (const [name, lines] of blocks(path.join(examplesDir, file))) {
    if (!byName.has(name)) {
      byName.set(name, [])
    }
    byName.get(name).push({ file, code: code(lines), lines: lines.length })
  }
}

const drifted = []
let shared = 0
for (const [name, entries] of byName) {
  if (entries.length < 2 || name in DIVERGES) {
    continue
  }
  const variants = new Map()
  for (const e of entries) {
    if (!variants.has(e.code)) {
      variants.set(e.code, [])
    }
    variants.get(e.code).push(e.file)
  }
  if (variants.size === 1) {
    shared++
    continue
  }
  drifted.push({ name, variants })
}

for (const { name, variants } of drifted) {
  console.log(`DRIFT ${name} — ${variants.size} versions across example files:`)
  const versions = [...variants.entries()]
  for (const [, files] of versions) {
    console.log(`        ${files.join(', ')}`)
  }
  // show the first difference rather than both blocks in full
  const [a, b] = versions.map(([text]) => text.split('\n'))
  const at = a.findIndex((line, i) => line !== b[i])
  if (at >= 0) {
    console.log(`      first difference at line ${at + 1} of the block:`)
    console.log(`        - ${a[at] ?? '(end of block)'}`)
    console.log(`        + ${b[at] ?? '(end of block)'}`)
  }
}

const unused = Object.keys(DIVERGES).filter(n => !byName.has(n))
for (const name of unused) {
  console.log(`STALE DIVERGES entry "${name}" — no such block in any example`)
}

// Widely-copied blocks nobody has justified yet. DIVERGES entries are exempt:
// those already carry a reason for existing in every file.
const unjustified = []
let redundantLines = 0
for (const [name, entries] of byName) {
  if (entries.length < 2) {
    continue
  }
  redundantLines += entries
    .slice(1)
    .reduce((total, entry) => total + entry.lines, 0)
  if (
    entries.length >= COPY_THRESHOLD &&
    !(name in COPIED) &&
    !(name in DIVERGES)
  ) {
    unjustified.push({ name, files: entries.map(e => e.file) })
  }
}

for (const { name, files } of unjustified) {
  console.log(
    `UNJUSTIFIED ${name} — copied into ${files.length} files with no COPIED entry:\n` +
      `        ${files.join(', ')}\n` +
      "      Either it is the reader's own to write (add it to COPIED with the\n" +
      '      reason) or JBrowse should publish it and the examples should import\n' +
      '      it like any reader would. See CLAUDE.md.',
  )
}

const staleCopied = Object.keys(COPIED).filter(
  n => (byName.get(n)?.length ?? 0) < COPY_THRESHOLD,
)
for (const name of staleCopied) {
  console.log(
    `STALE COPIED entry "${name}" — now in fewer than ${COPY_THRESHOLD} examples`,
  )
}

console.log(
  `\n${shared} block(s) identical across files, ${drifted.length} drifted, ` +
    `${Object.keys(DIVERGES).length - unused.length} allowed to diverge, ` +
    `${Object.keys(COPIED).length - staleCopied.length} justified as the reader's own\n` +
    `${redundantLines} redundant line(s) — copies beyond the first. Not a budget: ` +
    'adding a page adds copies, which is the rule working.',
)
process.exit(
  drifted.length + unused.length + unjustified.length + staleCopied.length
    ? 1
    : 0,
)
