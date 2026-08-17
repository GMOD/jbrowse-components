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
// Run `pnpm measurement-tables`, or `--check` in CI (`pnpm autogen`).
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  check,
  checkOrWriteAll,
  docFiles,
  formatMarkdown,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { loadMeasurements, renderTable } from './measurements.ts'
import { repoRoot } from './paths.ts'

const BLOCK = /^<!--\s*BEGIN GENERATED MEASUREMENT\s+([\w-]+)\s*-->$/

const agentDocsDir = join(repoRoot, 'agent-docs')

const records = loadMeasurements()
const problems: string[] = []
const published = new Set<string>()

const generated = docFiles(agentDocsDir)
  .map(path => {
    const text = readFileSync(path, 'utf8')
    const ids = text
      .split('\n')
      .map(line => BLOCK.exec(line.trim())?.[1])
      .filter(id => id !== undefined)
    if (ids.length === 0) {
      return undefined
    }
    const rel = relative(repoRoot, path)
    let content = text
    for (const id of ids) {
      const record = records.get(id)
      if (!record) {
        problems.push(`${rel}: no agent-docs/measurements/${id}.json`)
        continue
      }
      if (published.has(id)) {
        problems.push(
          `${rel}: publishes "${id}", which another doc also publishes`,
        )
        continue
      }
      published.add(id)
      content = spliceGeneratedBlock({
        path,
        marker: `MEASUREMENT ${id}`,
        // The trailing blank is the one `spliceGeneratedBlock` does not add:
        // it joins the body straight onto the END marker, so without this the
        // table's last row and the comment share a paragraph.
        body: [...renderTable(record), ''],
        // A doc with two blocks needs the previous splice's output rather than
        // what is still on disk.
        text: content,
      })
    }
    return {
      path,
      content: formatMarkdown(content, path),
      label: `${rel} measurement tables`,
    }
  })
  .filter(g => g !== undefined)

for (const id of records.keys()) {
  if (!published.has(id)) {
    problems.push(
      `agent-docs/measurements/${id}.json is published by no doc — add a BEGIN/END GENERATED MEASUREMENT ${id} block, or delete the record`,
    )
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} measurement record problem(s):`)
  for (const p of problems) {
    console.error(`  ${p}`)
  }
  process.exit(1)
}

if (generated.length === 0) {
  console.error('no measurement blocks found — did the marker spelling change?')
  process.exit(1)
}

checkOrWriteAll(
  generated,
  'run `pnpm measurement-tables` and commit the result',
)

if (!check) {
  // The count that should go down. `hand` means a human typed the values in and
  // only a human can refresh them, which is the state every one of these was in
  // before it had a record at all — the record makes it visible rather than
  // fixing it.
  const byHand = [...records.values()].filter(m => m.source.kind === 'hand')
  console.log(
    `${records.size} measurement(s) published, ${byHand.length} still hand-recorded`,
  )
  for (const m of byHand) {
    console.log(`  hand: ${m.id} (${m.measured})`)
  }
}
