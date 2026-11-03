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
// layering test and the ABI removals table's `assertCovers`: the tag exists only to be
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
import { readDoc } from './api-docs/format.ts'
import { linkedAgentDocs } from './check-utils.ts'
import { markerDocBlocks, rewriteGroupedMarkerBlocks } from './markerDocs.ts'
import { loadMeasurements } from './measurements.ts'

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
  for (const { file, group, begin, end } of markerDocBlocks(
    'MEASUREMENT',
    'agent-docs/',
  )) {
    const rows = readDoc(file)
      .split('\n')
      .slice(begin + 1, end)
      .filter(line => TABLE_ROW.test(line))
      .map(line => line.trimEnd())
    const seen = byId.get(group)
    // Two rows is a header and its delimiter with no data under it, which is
    // what a block placed one table too high produces.
    if (rows.length < 3) {
      problems.push(`${file}: the "${group}" block holds no markdown table`)
    } else if (seen) {
      problems.push(
        `measurement "${group}" is defined twice: ${seen.file} and ${file}`,
      )
    } else {
      byId.set(group, { id: group, file, rows })
    }
  }
  return byId
}

export function writePublishedMeasurements() {
  // Collected rather than thrown, all of them, so one run names every authoring
  // mistake: these arrive in batches when a page is written or a doc is split,
  // and a script that dies on the first turns that into one round trip each.
  const problems: string[] = []
  const sources = collectSources(problems)
  const consumed = new Set<string>()

  // The docs site and the pending release announcement drafts. A draft is the
  // most exposed consumer there is: `pnpm release` renders, commits, tags and
  // pushes it in one run, so a table typed into one by hand publishes before
  // anyone can re-read it — which is how the v5.0.0 draft came to carry a pan
  // column no record holds beside a zoom column that is exact.
  const pages = [
    ...markerDocBlocks('MEASUREMENT', 'website/docs/'),
    ...markerDocBlocks('MEASUREMENT', 'website/release_announcement_drafts/'),
  ]
  for (const { file, group: id } of pages) {
    const source = sources.get(id)
    if (!source) {
      problems.push(
        `${file}: no agent-doc carries <!-- BEGIN GENERATED MEASUREMENT ${id} --> for this table to copy`,
      )
    } else {
      consumed.add(id)
      if (!linkedAgentDocs(readDoc(file)).has(source.file)) {
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
          `${file}: publishes "${id}" but links no ${source.file} — a reader gets the table and no route to the measurement`,
        )
      }
    }
  }

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
    throw new Error(
      `${problems.length} measurement problem(s):\n${problems.map(p => `  ${p}`).join('\n')}`,
    )
  }

  // The two docs trees are formatted independently, so a source table's
  // column padding is whatever oxfmt made of the widths around it *there* and
  // will not survive being pasted under different neighbours here. `writeDoc`
  // formats the whole page the way `pnpm format` will.
  return rewriteGroupedMarkerBlocks(
    'MEASUREMENT',
    id => sources.get(id)!.rows.join('\n'),
    { files: [...new Set(pages.map(p => p.file))] },
  ).changed
}
