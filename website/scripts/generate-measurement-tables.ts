// Renders each `agent-docs/measurements/<id>.json` record into the doc that
// publishes it.
//
// The first hop of the chain, and the one nothing gated before. `measurements.ts`
// says why the record is the source of truth; this file is the splice, plus the
// two integrity checks a two-ended mapping needs:
//
//   record ──this──▶ agent-doc table ──sync-measurements──▶ website table
//
// Both directions are errors, the same way `sync-measurements` treats its own
// pair. A block naming a record that does not exist is the obvious one. A record
// no doc publishes is the other, and it is the one that rots: a record left
// behind after a doc drops its table looks like a maintained measurement and is
// read by nobody.
//
// Runs in `website/scripts/api-docs/markers.ts` (`pnpm measurement-tables`).
import { markerDocBlocks, rewriteGroupedMarkerBlocks } from './markerDocs.ts'
import { loadMeasurements, renderTable } from './measurements.ts'

export function writeMeasurementTables() {
  const records = loadMeasurements()
  const problems: string[] = []
  const published = new Set<string>()
  const owners = markerDocBlocks('MEASUREMENT', 'agent-docs/')
  for (const { file, group } of owners) {
    if (!records.has(group)) {
      problems.push(`${file}: no agent-docs/measurements/${group}.json`)
    } else if (published.has(group)) {
      problems.push(
        `${file}: publishes "${group}", which another doc also publishes`,
      )
    }
    published.add(group)
  }

  for (const id of records.keys()) {
    if (!published.has(id)) {
      problems.push(
        `agent-docs/measurements/${id}.json is published by no doc — add a BEGIN/END GENERATED MEASUREMENT ${id} block, or delete the record`,
      )
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `${problems.length} measurement record problem(s):\n${problems.map(p => `  ${p}`).join('\n')}`,
    )
  }

  const { changed } = rewriteGroupedMarkerBlocks(
    'MEASUREMENT',
    // The trailing blank is the one the splice does not add: it joins the body
    // straight onto the END marker, so without this the table's last row and
    // the comment share a paragraph.
    id => [...renderTable(records.get(id)!), ''].join('\n'),
    { files: [...new Set(owners.map(o => o.file))] },
  )

  // The count that should go down. `hand` means a human typed the values in and
  // only a human can refresh them, which is the state every one of these was in
  // before it had a record at all — the record makes it visible rather than
  // fixing it.
  const byHand = [...records.values()].filter(m => m.source.kind === 'hand')
  console.log(
    `${records.size} measurement(s) published, ${byHand.length} still hand-recorded`,
  )
  return changed
}
