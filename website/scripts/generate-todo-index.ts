// Generates agent-docs/TODO.md's three tables — and the sentence that counts
// them — from the entries under agent-docs/todo/, one table per
// `metadata.category`.
//
// This replaced a hand-maintained index and the checker that guarded it. The
// argument for checking rather than generating was that two of the three
// columns — the area and the first move on work nobody has started — are
// editorial judgements a generator would have to invent or drop. That is an
// argument about where the judgement is WRITTEN, not about who assembles the
// table: an entry now carries its own `area`, `first_move` and `order` in the
// frontmatter beside the `category` it already had, so the judgement stays with
// the entry and the table is derived. Editing an entry no longer means editing
// two files, and a row cannot drift from the doc it points at.
//
// `order` is the position within the entry's table, and it stays editorial —
// each table's prose says what its order is by. Two entries in one table cannot
// share a number; gaps are fine, since a closed entry leaves one.
//
// The row label is the entry's own `# ` heading, so an entry is spelled one way
// in the file and in the index.
//
// The counts sentence is here because it rots the same way the table did: it
// had already drifted to "Nine are blocked on a visual call" against seven
// entries, which is what got the old checker its one derived-prose check.
//
// Run: `pnpm autogen` (or `--check` in CI).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  checkOrWrite,
  markdownTableLines,
  parseFrontmatter,
  parseMetadata,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

// `clause` is what the counts sentence says about a category — the predicate,
// so a category can say "are ordinary work" or "open with" as its own grammar
// wants. It is the one piece of prose here that is a judgement rather than a
// rendering.
const TABLES = [
  {
    category: 'ready',
    marker: 'TODO READY INDEX',
    clause: 'are ordinary work someone can pick up',
  },
  {
    category: 'visual-call',
    marker: 'TODO VISUAL-CALL INDEX',
    clause:
      "are blocked on a visual call that is not the implementer's to make",
  },
  {
    category: 'measure-first',
    marker: 'TODO MEASURE-FIRST INDEX',
    clause:
      'open with an instruction to go measure something, because the premise is not established and building first would be guessing',
  },
]

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

function numberWord(n: number, capitalized = false): string {
  const word = NUMBER_WORDS[n]
  if (word === undefined) {
    throw new Error(
      `agent-docs/todo/ holds ${n} entries in one category, past the end of NUMBER_WORDS in website/scripts/generate-todo-index.ts. Add the words.`,
    )
  }
  return capitalized ? word : word.toLowerCase()
}

function wrap(sentence: string, width = 80): string[] {
  const lines: string[] = []
  for (const word of sentence.split(' ')) {
    const line = lines.at(-1)
    if (line === undefined || `${line} ${word}`.length > width) {
      lines.push(word)
    } else {
      lines[lines.length - 1] = `${line} ${word}`
    }
  }
  return lines
}

interface Entry {
  file: string
  title: string
  category: string
  area: string
  firstMove: string
  order: number
}

const todoDir = join(repoRoot, 'agent-docs', 'todo')
const todoPath = join(repoRoot, 'agent-docs', 'TODO.md')

function readEntry(file: string): Entry {
  const rel = `agent-docs/todo/${file}`
  const text = readFileSync(join(todoDir, file), 'utf8')
  const fm = parseFrontmatter(text)
  const meta = parseMetadata(text)
  if (!fm?.name || !fm.description) {
    throw new Error(
      `${rel}: no \`name:\`/\`description:\` frontmatter — without them the entry is invisible to anyone scanning the directory (see agent-docs/CLAUDE.md)`,
    )
  }
  const title = /^#\s+(.*\S)\s*$/m.exec(text)?.[1]
  if (!title) {
    throw new Error(`${rel}: no \`# \` heading, which is the index row's label`)
  }
  const missing = ['category', 'area', 'first_move', 'order'].filter(
    k => !meta[k],
  )
  if (missing.length) {
    throw new Error(
      `${rel}: \`metadata\` is missing ${missing.join(', ')}. Every field the index row carries lives there now — the row is generated from it.`,
    )
  }
  if (!TABLES.some(t => t.category === meta.category)) {
    throw new Error(
      `${rel}: \`category: ${meta.category}\` is not one of ${TABLES.map(t => t.category).join(', ')}, so the entry has no table to sit in.`,
    )
  }
  const order = Number(meta.order)
  if (!Number.isInteger(order)) {
    throw new Error(`${rel}: \`order: ${meta.order}\` is not a whole number`)
  }
  return {
    file,
    title,
    category: meta.category!,
    area: meta.area!,
    firstMove: meta.first_move!,
    order,
  }
}

const entries = readdirSync(todoDir)
  .filter(f => f.endsWith('.md'))
  .map(readEntry)
  .sort((a, b) => a.order - b.order || a.file.localeCompare(b.file))

const byCategory = (category: string) =>
  entries.filter(e => e.category === category)

// A tie sorts by filename, which renders a plausible table in an order nobody
// chose — the one way `order` can be wrong without looking wrong. Gaps stay
// legal: a closed entry leaves one, and renumbering the survivors is churn.
for (const { category } of TABLES) {
  const seen = new Map<number, string>()
  for (const entry of byCategory(category)) {
    const other = seen.get(entry.order)
    if (other) {
      throw new Error(
        `agent-docs/todo/${entry.file} and ${other} both declare \`order: ${entry.order}\` in the ${category} table, so which one comes first is the filenames rather than a decision. Give one of them another number.`,
      )
    }
    seen.set(entry.order, entry.file)
  }
}

let content = readFileSync(todoPath, 'utf8')

for (const { category, marker } of TABLES) {
  content = spliceGeneratedBlock({
    path: todoPath,
    marker,
    text: content,
    body: markdownTableLines(
      ['Item', 'Area', 'First move'],
      byCategory(category).map(
        e => `| [${e.title}](todo/${e.file}) | ${e.area} | ${e.firstMove} |`,
      ),
    ),
  })
}

const clauses = TABLES.map(
  ({ category, clause }) =>
    `${numberWord(byCategory(category).length)} ${clause}`,
)
content = spliceGeneratedBlock({
  path: todoPath,
  marker: 'TODO COUNTS',
  text: content,
  // Wrapped, because this block is prose in a hand-wrapped file rather than a
  // table — an 80-column paragraph among 80-column paragraphs.
  body: wrap(
    `${numberWord(entries.length, true)} entries are on the list: ${clauses
      .slice(0, -1)
      .join(', ')}, and ${clauses.at(-1)}.`,
  ),
})

checkOrWrite({
  path: todoPath,
  content,
  label: 'Backlog index',
  staleHint: 'run `pnpm autogen`',
})
