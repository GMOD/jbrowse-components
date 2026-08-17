// Keeps a measurement table on a public page identical to the one in the
// `agent-docs/` doc that owns the measurement.
//
// The public optimizations page is a digest of work recorded in
// `agent-docs/reference/`, so every table on it existed somewhere else first.
// Hand-copied, each one is a number with two homes and no way to tell which is
// current: a re-measurement updates the reference doc, the published page keeps
// quoting the old figure, and nothing in CI reads either. This is the same
// failure `sync-doc-snippets` fixes for code fences, one content type over.
//
// Tag the source table in the agent doc:
//
//   <!-- measurement: bgzf-pool-tabix -->
//   | workload | records | unpooled | pooled | speedup |
//   | --- | --- | --- | --- | --- |
//   …
//
// and bracket the copy on the public page the way every other generated block
// in this repo is bracketed:
//
//   <!-- BEGIN GENERATED MEASUREMENT bgzf-pool-tabix -->
//   …generated: replaced with that table…
//   <!-- END GENERATED MEASUREMENT bgzf-pool-tabix -->
//
// Run `pnpm sync-measurements` to update, `--check` to fail on drift (CI).
//
// ## Why the table travels whole
//
// There is no row filter and no column filter, deliberately, though the first
// draft of the public page wanted both — it had trimmed the tabix table from
// five rows to three and dropped the `records` column. A projection is an
// editorial decision taken once and then invisible: the next person to add a
// row to the reference table has no way to know the public page shows a subset,
// and a subset that silently stops being representative is a worse failure than
// a table with a row too many. Where a reference table genuinely reads wrong in
// public, fix it in the reference doc — both audiences want the clearer header.
//
// ## Both directions are errors
//
// A block naming a measurement nothing defines is the obvious one. A tagged
// table nothing consumes is checked too, on the same reasoning as the workspace
// layering test and `ReExports/abi.test.ts`: the tag exists only to be
// published, so one left behind after a page drops its block is a claim that
// something is being kept in step when nothing is.
//
// ## Publishing a table means linking the doc
//
// A page that consumes a measurement must also LINK the doc it came from. A
// table without that link hands the reader a figure and no way to reach what
// produced it, and the prose around such a table quotes the same doc's other
// numbers — which then trace only by coincidence, since `check-quoted-figures`
// searches the docs a page links. Three of the nine blocks were in that state:
// MULTI_SAMPLE_VARIANTS, INTERACTION_PERF and EAGER_BUNDLE.
//
// It belongs here rather than in `check-quoted-figures` because here it is
// exact. This page consumes THIS file, so the missing link is a fact about the
// page; over there it could only ever be inferred from a number that failed to
// match, which is the same evidence a typo produces.
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  check,
  checkOrWriteAll,
  docFiles,
  formatMarkdown,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'

const SOURCE_TAG = /^<!--\s*measurement:\s*([\w-]+)\s*-->$/
const CONSUMER_BEGIN = /^<!--\s*BEGIN GENERATED MEASUREMENT\s+([\w-]+)\s*-->$/

const agentDocsDir = join(repoRoot, 'agent-docs')

interface Source {
  id: string
  file: string
  rows: string[]
}

const TABLE_ROW = /^\s*\|.*\|\s*$/

/**
 * Every `<!-- measurement: id -->`-tagged table under `agent-docs/`.
 *
 * The table is the run of `|`-delimited lines starting at the first non-blank
 * line below the tag. A tag with prose under it is an error rather than an
 * empty block: an empty generated block reads on the page as "there is nothing
 * to measure here", which is the opposite of what the tag was put there to say.
 */
function collectSources(problems: string[]) {
  const byId = new Map<string, Source>()
  for (const file of docFiles(agentDocsDir)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      const tag = SOURCE_TAG.exec(line.trim())
      if (!tag) {
        return
      }
      const id = tag[1]!
      const rel = relative(repoRoot, file)
      let start = i + 1
      while (start < lines.length && lines[start]!.trim() === '') {
        start++
      }
      const rows: string[] = []
      for (let k = start; k < lines.length && TABLE_ROW.test(lines[k]!); k++) {
        rows.push(lines[k]!.trimEnd())
      }
      // Two rows is a header and its delimiter with no data under it, which is
      // what a tag placed one table too high produces.
      if (rows.length < 3) {
        problems.push(
          `${rel}: <!-- measurement: ${id} --> is not above a markdown table`,
        )
        return
      }
      const seen = byId.get(id)
      if (seen) {
        problems.push(
          `measurement "${id}" is defined twice: ${seen.file} and ${rel}`,
        )
        return
      }
      byId.set(id, { id, file: rel, rows })
    })
  }
  return byId
}

// Collected rather than thrown, all of them, so one run names every authoring
// mistake: these arrive in batches when a page is written or a doc is split,
// and a script that dies on the first turns that into one round trip each.
const problems: string[] = []
const sources = collectSources(problems)
const consumed = new Set<string>()

const generated = docFiles(docsDir)
  .map(path => {
    const text = readFileSync(path, 'utf8')
    const ids = text
      .split('\n')
      .map(l => CONSUMER_BEGIN.exec(l.trim())?.[1])
      .filter(id => id !== undefined)
    if (ids.length === 0) {
      return undefined
    }
    let content = text
    for (const id of ids) {
      const source = sources.get(id)
      if (!source) {
        problems.push(
          `${relative(repoRoot, path)}: no <!-- measurement: ${id} --> in agent-docs`,
        )
        continue
      }
      consumed.add(id)
      if (!text.includes(source.file)) {
        // A page that publishes a doc's table and never links the doc leaves the
        // reader with a figure and no way to reach what produced it. The check
        // is here rather than in `check-quoted-figures` because here it is
        // exact: this page consumes THIS file, so the link is a fact, not a
        // guess from a matching number. Three pages-worth of prose figures were
        // traceable only by coincidence for want of it.
        problems.push(
          `${relative(repoRoot, path)}: publishes "${id}" but links no ${source.file} — a reader gets the table and no route to the measurement`,
        )
      }
      content = spliceGeneratedBlock({
        path,
        marker: `MEASUREMENT ${id}`,
        body: source.rows,
        // spliceGeneratedBlock reads the file itself, so a page with two blocks
        // needs the previous splice's output rather than what is on disk.
        text: content,
      })
    }
    return {
      path,
      // The two docs trees are formatted independently, so a source table's
      // column padding is whatever oxfmt made of the widths around it *there*
      // and will not survive being pasted under different neighbours here.
      // Format the whole page the way `pnpm format` will, or that pass and this
      // one rewrite each other and `--check` never settles.
      content: formatMarkdown(content, path),
      label: `${relative(repoRoot, path)} measurement tables`,
    }
  })
  .filter(g => g !== undefined)

for (const [id, source] of sources) {
  if (!consumed.has(id)) {
    problems.push(
      `${source.file}: <!-- measurement: ${id} --> is published by no page — delete the tag or add a block for it`,
    )
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} measurement problem(s):`)
  for (const p of problems) {
    console.error(`  ${p}`)
  }
  process.exit(1)
}

if (generated.length === 0) {
  console.error('no measurement blocks found — did the marker spelling change?')
  process.exit(1)
}

checkOrWriteAll(generated, 'run `pnpm sync-measurements` and commit the result')

if (!check) {
  console.log(`${sources.size} measurement(s) published`)
}
