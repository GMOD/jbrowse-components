// Generates the ADR index table in
// `agent-docs/architecture-decision-records/README.md` from the ADRs
// themselves, so a new/renamed/re-statused ADR can't drift from the index.
//
// Each `adr-NNN-*.md` carries frontmatter:
//
//   ---
//   status: Accepted | Rejected | Superseded | Closed | Proposed
//   summary: "one line — what was decided"
//   ---
//
// `summary` is the index's Decision column. It is deliberately hand-written
// rather than derived from the `# ADR-NNN: …` title: for a superseded or
// rejected ADR the useful one-liner names the successor or the thing that was
// rejected, which the title doesn't say.
//
// Only the table between the BEGIN/END markers is generated; the prose above it
// is hand-maintained. Run: `pnpm gen-adr-index` (or `--check` in CI).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  checkOrWrite,
  markdownTable,
  parseFrontmatter,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const adrDir = join(repoRoot, 'agent-docs', 'architecture-decision-records')
const indexPath = join(adrDir, 'README.md')

const STATUSES = [
  'Accepted',
  'Rejected',
  'Superseded',
  'Closed',
  'Proposed',
] as const

// Numbers whose ADRs were deleted. They keep a row so the gap is explained and
// nobody reuses the number.
const REMOVED: { range: string; sortKey: number; note: string }[] = [
  {
    range: '013–015',
    sortKey: 13,
    note: 'Graph-genome ADRs (bubble shape, chain contraction, cross-path symmetry) — deleted with `graph-core`; numbers not reused',
  },
]

interface Adr {
  sortKey: number
  row: string
}

function collectAdrs() {
  const adrs: Adr[] = []
  for (const file of readdirSync(adrDir)) {
    const num = /^adr-(\d+)-.*\.md$/.exec(file)?.[1]
    if (num === undefined) {
      continue
    }
    const fm = parseFrontmatter(readFileSync(join(adrDir, file), 'utf8'))
    if (!fm) {
      throw new Error(`${file}: missing frontmatter (need status + summary)`)
    }
    const { status, summary } = fm
    if (status === undefined || summary === undefined) {
      throw new Error(`${file}: frontmatter needs both status and summary`)
    }
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      throw new Error(
        `${file}: status "${status}" is not one of ${STATUSES.join(', ')}`,
      )
    }
    adrs.push({
      sortKey: Number(num),
      row: `| [${num}](${file}) | ${status} | ${summary} |`,
    })
  }
  for (const { range, sortKey, note } of REMOVED) {
    adrs.push({ sortKey, row: `| ${range} | Removed | ${note} |` })
  }
  return adrs.sort((a, b) => a.sortKey - b.sortKey)
}

checkOrWrite({
  path: indexPath,
  content: spliceGeneratedBlock({
    path: indexPath,
    marker: 'ADR INDEX',
    body: markdownTable(
      ['ADR', 'Status', 'Decision'],
      collectAdrs().map(a => a.row),
    ),
  }),
  label: 'ADR index',
  staleHint: 'run `pnpm autogen`',
})
