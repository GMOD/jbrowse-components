// agent-docs/TODO.md is an index over agent-docs/todo/, one file per backlog
// item. This fails when that index and the directory disagree.
//
// It exists because the table is exactly the shape agent-docs/CLAUDE.md warns
// about — "if a doc sentence tells the reader to go look at a file, the table
// under it should be generated from that file" — one level in: the rows name
// files under todo/, and nothing re-derived them. The table used to restate
// each item's own heading inside TODO.md itself, and it drifted twice before
// anyone noticed (`The SV inspector rebuilds its chord track` never had a row;
// `Pool the coordinate ruler's tick <div>s` lost one the day it was added),
// which is the failure mode this check still guards against.
//
// Deliberately NOT a generator, unlike the `ideas/` and `reference/` indexes.
// Those tables are two columns, both derivable from a doc's frontmatter. This
// one carries `Area` and `First move`, which are editorial judgements about
// work nobody has done yet — a generator would have to invent them or drop
// them, and "the first move" is the most useful column in the table. So: check
// the half that rots (does every file have a row, does every row point
// somewhere real) and leave the half that cannot.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseFrontmatter, reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'

const todoPath = join(repoRoot, 'agent-docs', 'TODO.md')
const todoDir = join(repoRoot, 'agent-docs', 'todo')
const rel = 'agent-docs/TODO.md'

const files = readdirSync(todoDir).filter(f => f.endsWith('.md'))

const lines = readFileSync(todoPath, 'utf8').split('\n')

// A row is `| [label](todo/<file>) | area | first move |`.
const rowFiles = new Map<string, string>()
for (const line of lines) {
  const m = /^\|\s*\[([^\]]+)]\(todo\/([^)]+\.md)\)\s*\|/.exec(line)
  if (m) {
    rowFiles.set(m[2]!, m[1]!)
  }
}

const problems: string[] = []

const categoryByFile = new Map<string, string | undefined>()
for (const file of files) {
  const fm = parseFrontmatter(readFileSync(join(todoDir, file), 'utf8'))
  if (!fm?.name || !fm.description) {
    problems.push(
      `agent-docs/todo/${file}: no \`name:\`/\`description:\` frontmatter.`,
    )
  }
  const categoryMatch = /category:\s*(\S+)/.exec(
    readFileSync(join(todoDir, file), 'utf8'),
  )
  categoryByFile.set(file, categoryMatch?.[1])
  if (!rowFiles.has(file)) {
    problems.push(
      `agent-docs/todo/${file}: has no index row in ${rel}. Add one, or fold the entry into its neighbour and delete the file.`,
    )
  }
}

for (const [file, label] of rowFiles) {
  if (!files.includes(file)) {
    problems.push(
      `${rel}: index row "${label}" points at todo/${file}, which does not exist. The entry was renamed or removed — other docs and source comments may cite this filename, so check what else names it before settling on a fix.`,
    )
  }
}

// The preamble also carries a count — "Nine are blocked on a visual call" —
// which rots the same way the table did, and had already drifted to seven by
// the time anyone counted. It is the one prose number in the file that is
// derivable, so derive it from each doc's own `metadata.category`.
const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
]

const visualCallEntries = [...categoryByFile.values()].filter(
  c => c === 'visual-call',
).length

const claim = /(\w+) are blocked on a visual call/.exec(
  lines.join(' ').replaceAll(/\s+/g, ' '),
)
const expected = NUMBER_WORDS[visualCallEntries]
if (!claim) {
  problems.push(
    `${rel}: the preamble no longer says "<N> are blocked on a visual call". Restore the sentence or drop this check with it.`,
  )
} else if (expected === undefined) {
  // Past the end of the list the message used to read `Write "undefined"`,
  // which names neither the count nor the fix. The list is the thing that ran
  // out, so say so.
  problems.push(
    `${rel}: agent-docs/todo/ holds ${visualCallEntries} entries with \`category: visual-call\`, past the end of NUMBER_WORDS in website/scripts/check-todo-index.ts. Add the word and update the preamble.`,
  )
} else if (claim[1] !== expected) {
  problems.push(
    `${rel}: the preamble says "${claim[1]} are blocked on a visual call" and agent-docs/todo/ holds ${visualCallEntries} with \`category: visual-call\`. Write "${expected}".`,
  )
}

reportProblems(
  problems,
  `${rel}: ${files.length} entries in todo/, all indexed, every row resolves; ${visualCallEntries} blocked on a visual call, as the preamble says.`,
)
