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
// This is the SECOND hop of the chain:
//
//   agent-docs/measurements/<id>.json     the record — values and provenance
//     │  generate-measurement-tables
//     ▼
//   agent-docs/…/DOC.md                   the doc that owns the measurement
//     │  this file
//     ▼
//   website/docs/…/page.md                the public copy
//
// Both ends carry the same marker pair, so there is one spelling to know:
//
//   <!-- BEGIN GENERATED MEASUREMENT bgzf-pool-tabix -->
//   …generated…
//   <!-- END GENERATED MEASUREMENT bgzf-pool-tabix -->
//
// Run `pnpm sync-measurements` to update, `--check` to fail on drift (CI). It
// runs AFTER `measurement-tables` in autogen — this reads what that one wrote.
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
  linkedAgentDocs,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { loadMeasurements } from './measurements.ts'
import { docsDir, repoRoot } from './paths.ts'

const BEGIN = /^<!--\s*BEGIN GENERATED MEASUREMENT\s+([\w-]+)\s*-->$/
const END = /^<!--\s*END GENERATED MEASUREMENT\s+([\w-]+)\s*-->$/

const agentDocsDir = join(repoRoot, 'agent-docs')

interface Source {
  id: string
  file: string
  rows: string[]
}

const TABLE_ROW = /^\s*\|.*\|\s*$/

/**
 * Every generated measurement table under `agent-docs/`.
 *
 * The doc's block is itself generated, from `agent-docs/measurements/<id>.json`
 * by `generate-measurement-tables` — so this reads the middle of the chain, not
 * its head, and the rows below are already normalized. Reading the rendered
 * table rather than re-rendering the record is deliberate: what the website
 * publishes should be what the doc shows, and going back to the record would
 * let the two disagree while both looked generated.
 */
function collectSources(problems: string[]) {
  const byId = new Map<string, Source>()
  for (const file of docFiles(agentDocsDir)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    const rel = relative(repoRoot, file)
    lines.forEach((line, i) => {
      const begin = BEGIN.exec(line.trim())
      if (!begin) {
        return
      }
      const id = begin[1]!
      const rows: string[] = []
      let k = i + 1
      for (; k < lines.length && !END.test(lines[k]!.trim()); k++) {
        if (TABLE_ROW.test(lines[k]!)) {
          rows.push(lines[k]!.trimEnd())
        }
      }
      if (k === lines.length) {
        problems.push(
          `${rel}: BEGIN GENERATED MEASUREMENT ${id} has no END — the block would swallow the rest of the doc`,
        )
        return
      }
      // Two rows is a header and its delimiter with no data under it, which is
      // what a block placed one table too high produces.
      if (rows.length < 3) {
        problems.push(`${rel}: the "${id}" block holds no markdown table`)
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
      .map(l => BEGIN.exec(l.trim())?.[1])
      .filter(id => id !== undefined)
    if (ids.length === 0) {
      return undefined
    }
    let content = text
    const linked = linkedAgentDocs(text)
    for (const id of ids) {
      const source = sources.get(id)
      if (!source) {
        problems.push(
          `${relative(repoRoot, path)}: no <!-- measurement: ${id} --> in agent-docs`,
        )
        continue
      }
      consumed.add(id)
      if (!linked.has(source.file)) {
        // A page that publishes a doc's table and never links the doc leaves the
        // reader with a figure and no way to reach what produced it. The check
        // is here rather than in `check-quoted-figures` because here it is
        // exact: this page consumes THIS file, so the link is a fact, not a
        // guess from a matching number. Three pages-worth of prose figures were
        // traceable only by coincidence for want of it.
        //
        // A LINK, via the same helper `check-quoted-figures` scopes its doc
        // haystack with — not a bare mention of the path. The two have to agree,
        // or a page satisfies this one by naming the file in prose and still
        // gives the other no cited doc to search.
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

// A doc table no page publishes. Still an error by default — a page quietly
// losing its block looks exactly like this — but no longer necessarily one: the
// doc's table is generated from its record either way, so a measurement can be
// internal on purpose. The record says which, and `"published": false` is that
// decision written down rather than inferred from an absence.
const records = loadMeasurements()
for (const [id, source] of sources) {
  if (consumed.has(id) || records.get(id)?.published === false) {
    continue
  }
  problems.push(
    `${source.file}: "${id}" is published by no page — add a block to the page that should carry it, or set "published": false on agent-docs/measurements/${id}.json`,
  )
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
