// Every tutorial's `## The data` stays a short intro and a flat
// bullet list: at most two intro paragraphs, nothing after the last list, and a
// paragraph between lists (a labelled group) only past ten bullets. Blocks
// inside `<details>` are exempt.
//
// Run: `pnpm check-data-sources`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docFiles, reportProblems } from './check-utils.ts'
import { docRelative, docsDir } from './paths.ts'

const MAX_UNGROUPED_BULLETS = 10
const MAX_INTRO_PARAGRAPHS = 2

function sectionProblems(src: string) {
  const section = /^## The data\n([\s\S]*?)(?=^## )/m.exec(src)
  if (!section) {
    return []
  }
  const blocks = section[1]!
    .replaceAll(/<details>[\s\S]*?<\/details>/g, '')
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean)
  const isList = blocks.map(b => b.startsWith('- '))
  const bullets = blocks.flatMap(b => b.match(/^- /gm) ?? []).length
  const firstList = isList.indexOf(true)
  const lastList = isList.lastIndexOf(true)
  const problems: string[] = []
  if (firstList < 0) {
    return problems
  }
  if (firstList > MAX_INTRO_PARAGRAPHS) {
    problems.push(
      `${firstList} intro paragraphs before the first list; the limit is ${MAX_INTRO_PARAGRAPHS}`,
    )
  }
  if (lastList < blocks.length - 1) {
    problems.push(
      'a paragraph follows the last list; the bullets carry what the page needs',
    )
  }
  const grouped = isList.slice(firstList, lastList).includes(false)
  if (grouped && bullets <= MAX_UNGROUPED_BULLETS) {
    problems.push(
      `a paragraph splits the list at ${bullets} bullets; group only past ${MAX_UNGROUPED_BULLETS}`,
    )
  }
  return problems
}

const pages = docFiles(join(docsDir, 'tutorials')).filter(
  f => !f.endsWith('CLAUDE.md'),
)
const errors = pages.flatMap(file =>
  sectionProblems(readFileSync(file, 'utf8')).map(
    p => `${docRelative(file)}: ${p}`,
  ),
)
reportProblems(
  errors,
  `${pages.length} tutorials keep "The data" short and flat.`,
)
