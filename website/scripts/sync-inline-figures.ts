// Splices one value out of a measurement record into a sentence.
//
// The table half of this is `generate-measurement-tables`. This is the other
// half, and the one that catches the failure a table generator structurally
// cannot: prose restating a cell from the table directly above it.
//
//   "12.5ms is inside a 16ms frame"                 (SYNTENY_PICKING.md)
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
//   <!--m:bgzf-pool-tabix.speedup.range-->1.34-1.46x<!--/m-->
//
// The reference is in a comment so it survives regeneration, and the value is
// plain text so a reader — on the site, on GitHub, in an editor — sees a figure
// rather than a template. Same trade as the BEGIN/END blocks around a table,
// written small enough to sit inside a sentence.
//
// Two shapes:
//
//   <id>.<row>.<column>                              one cell
//   <id>.<column>.<min|max|span|range|first|last>    over the column
//
// Run `pnpm inline-figures`, or `--check` in CI (`pnpm autogen`), AFTER the two
// table generators — it reads the same records they do, so the order only
// matters for the report reading sensibly.
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { check, checkOrWriteAll, docFiles } from './check-utils.ts'
import { loadMeasurements, resolveReference } from './measurements.ts'
import { docsDir, repoRoot } from './paths.ts'

// The value is anything up to the closing marker EXCEPT another marker, so an
// unclosed reference fails here rather than swallowing the rest of the
// paragraph into the next one's value.
const INLINE = /<!--m:([\w.-]+)-->((?:(?!<!--)[\s\S])*?)<!--\/m-->/g

const records = loadMeasurements()
const problems: string[] = []
let spliced = 0

const trees = [join(repoRoot, 'agent-docs'), docsDir]

const generated = trees
  .flatMap(tree => docFiles(tree))
  .map(path => {
    const text = readFileSync(path, 'utf8')
    if (!text.includes('<!--m:')) {
      return undefined
    }
    const rel = relative(repoRoot, path)
    const content = text.replaceAll(INLINE, (whole, ref: string) => {
      try {
        spliced++
        return `<!--m:${ref}-->${resolveReference(records, ref)}<!--/m-->`
      } catch (e) {
        problems.push(`${rel}: ${(e as Error).message}`)
        return whole
      }
    })
    // Deliberately NOT formatted. `formatMarkdown` rewraps the paragraph a
    // reference sits in, so a value one character wider would reflow lines the
    // author wrote and put this generator's output all over the diff.
    return { path, content, label: `${rel} inline figures` }
  })
  .filter(g => g !== undefined)

// An unclosed or misspelled marker leaves the reference in the file doing
// nothing, which reads exactly like one that resolved.
for (const path of trees.flatMap(tree => docFiles(tree))) {
  const text = readFileSync(path, 'utf8')
  const opens = (text.match(/<!--m:/g) ?? []).length
  const closes = (text.match(/<!--\/m-->/g) ?? []).length
  if (opens !== closes) {
    problems.push(
      `${relative(repoRoot, path)}: ${opens} <!--m:…--> against ${closes} <!--/m-->`,
    )
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} inline figure problem(s):`)
  for (const p of problems) {
    console.error(`  ${p}`)
  }
  process.exit(1)
}

checkOrWriteAll(generated, 'run `pnpm inline-figures` and commit the result')

if (!check) {
  console.log(`${spliced} inline figure(s) across ${generated.length} doc(s)`)
}
