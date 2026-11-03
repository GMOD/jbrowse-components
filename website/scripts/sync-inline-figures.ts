// Splices one value out of a measurement record into a sentence.
//
// The table half of this is `generate-measurement-tables`. This is the other
// half, and the one that catches the failure a table generator structurally
// cannot: prose restating a cell from the table directly above it.
//
//   "12.5ms is inside a 16ms frame"                 (SYNTENY_LOD.md)
//   "203 KB gzipped and 166 chunks were reachable"  (EAGER_BUNDLE.md, subtracted)
//   "So 1.35-1.45x on a big multi-sample VCF"       (BGZF_WORKER_POOL.md)
//
// All three were true when written. None of them moves when the table is
// regenerated, and the last was already wrong: the column runs 1.34x to 1.46x,
// so a range typed by eye had both ends inside the real one.
//
// `check-quoted-figures` cannot see any of this. It asks whether a figure occurs
// in a doc the page cites, and a stale figure does — the doc still carries the
// value it was copied from, or another doc carries it by coincidence.
//
// ## The spelling
//
//   1.34-1.46x<!--m:bgzf-pool-tabix.speedup.range-->
//
// The reference is in a comment so it survives regeneration, and the value is
// plain text so a reader — on the site, on GitHub, in an editor — sees a figure
// rather than a template.
//
// **The marker FOLLOWS the value, with no space anywhere in the pair**, and
// that is load-bearing rather than a style choice. A markdown line beginning
// `<!--` is an HTML *block* in CommonMark, not an inline comment, so it ends
// the paragraph it lands in. The first spelling here bracketed the value
// between an opening and closing marker, and the first reflow after a rebase
// put the opening one at the start of a line and split a sentence in half.
// Written this way the figure and its reference are a single unbreakable token,
// so no rewrap can separate them or move the comment to a line start — which is
// also why `resolveReference` returns `203KB` rather than `203 KB`.
//
// Two shapes:
//
//   <id>.<row>.<column>                              one cell
//   <id>.<column>.<min|max|span|range|first|last>    over the column
//
// `<row>` is the row's first column slugified — `1-10k`,
// `two-alignments-tracks-pan`. Where another row shares that, the next column
// joins it: `buffer-churn-pan` measures every scenario on both rungs, so a cell
// of one is `two-alignments-tracks-pan-webgpu`. A `<row>` several rows answer to
// is an error rather than the first of them, since a marker that quietly quotes
// a row nobody chose is exactly the unverified figure this exists to catch.
//
// Runs in `website/scripts/api-docs/markers.ts` (`pnpm inline-figures`), AFTER the two
// table generators — it reads the same records they do, so the order only
// matters for the report reading sensibly.
import { join, relative } from 'node:path'

import { readDoc, writeDoc } from './api-docs/format.ts'
import { docFiles } from './check-utils.ts'
import { spliceInlineFigures } from './inlineFigures.ts'
import { loadMeasurements } from './measurements.ts'
import { docsDir, releaseDraftsDir, repoRoot } from './paths.ts'

// The release announcement drafts are in here with the docs, and they are the
// tree with the least slack: `pnpm release` renders, commits, tags and pushes a
// draft in one run, so a figure typed into one by hand is published before
// anyone can re-read it. `prepareDraftNotes` strips HTML comments on the way to
// the blog, so the marker is a draft-only convenience the reader never sees —
// the same bargain `normalizeDraftImages` makes for a repo-relative figure path.
const trees = [join(repoRoot, 'agent-docs'), docsDir, releaseDraftsDir]

export function writeInlineFigures() {
  const records = loadMeasurements()
  const problems: string[] = []
  const generated = trees
    .flatMap(tree => docFiles(tree))
    .map(path => {
      const text = readDoc(path)
      if (!text.includes('<!--m:')) {
        return undefined
      }
      const rel = relative(repoRoot, path)
      const { text: content, problems: found } = spliceInlineFigures(
        text,
        records,
      )
      problems.push(...found.map(p => `${rel}: ${p}`))
      // A website page is formatted with `proseWrap: always`, and `writeDoc`
      // reflows a wider value's paragraph at the end of the run.
      return writeDoc(path, content)
    })
    .filter(g => g !== undefined)

  if (problems.length > 0) {
    throw new Error(
      `${problems.length} inline figure problem(s):\n${problems.map(p => `  ${p}`).join('\n')}`,
    )
  }

  return generated.flat()
}
