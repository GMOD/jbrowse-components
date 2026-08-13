// agent-docs/TODO.md opens with a hand-written index of its own `###` entries.
// This fails when that index and the document disagree.
//
// It exists because the table is exactly the shape agent-docs/CLAUDE.md warns
// about — "if a doc sentence tells the reader to go look at a file, the table
// under it should be generated from that file" — one level in: the rows restate
// the document's own headings, and nothing re-derived them. It had drifted twice
// by the time anyone looked (`The SV inspector rebuilds its chord track` never
// had a row; `Pool the coordinate ruler's tick <div>s` lost one the day it was
// added), which is the failure mode that rule describes.
//
// Deliberately NOT a generator, unlike the `ideas/` and `reference/` indexes.
// Those tables are two columns, both derivable from a doc's frontmatter. This
// one carries `Area` and `First move`, which are editorial judgements about work
// nobody has done yet — a generator would have to invent them or drop them, and
// "the first move" is the most useful column in the table. So: check the half
// that rots (does every entry have a row, does every row point somewhere real)
// and leave the half that cannot.
//
// A `####` is a sub-entry deliberately folded into its parent and is not
// indexed; only `###` is an entry.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'

const todoPath = join(repoRoot, 'agent-docs', 'TODO.md')
const rel = 'agent-docs/TODO.md'

// GitHub's heading slug: drop code fences and punctuation, keep word characters
// (underscores included, so `#widen-ci_gate_suites` resolves), spaces to
// hyphens.
function slug(heading: string) {
  return heading
    .replaceAll('`', '')
    .toLowerCase()
    .replace(/[^\w\- ]/g, '')
    .trim()
    .replaceAll(' ', '-')
}

const lines = readFileSync(todoPath, 'utf8').split('\n')

const headings = new Map<string, string>()
for (const line of lines) {
  const m = /^### (.+)$/.exec(line)
  if (m) {
    headings.set(slug(m[1]!), m[1]!)
  }
}

// A row is `| [label](#anchor) | area | first move |`. Only same-document
// anchors are index rows; a row linking out is something else.
const rowAnchors = new Map<string, string>()
for (const line of lines) {
  const m = /^\|\s*\[([^\]]+)]\(#([^)]+)\)\s*\|/.exec(line)
  if (m) {
    rowAnchors.set(m[2]!, m[1]!)
  }
}

const problems: string[] = []

for (const [anchor, heading] of headings) {
  if (!rowAnchors.has(anchor)) {
    problems.push(
      `${rel}: heading "${heading}" has no index row. Add one, or fold the entry into its neighbour as a ####.`,
    )
  }
}

for (const [anchor, label] of rowAnchors) {
  if (!headings.has(anchor)) {
    problems.push(
      `${rel}: index row "${label}" points at #${anchor}, which is not a ### heading. The entry was renamed or removed — other docs and source comments cite these titles, so check what else names it before settling on a fix.`,
    )
  }
}

reportProblems(
  problems,
  `${rel}: ${headings.size} entries, all indexed, every row resolves.`,
)
