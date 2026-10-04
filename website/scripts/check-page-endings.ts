// Every tutorial's closing sections, by `pageEndingProblems`.
//
// Run: `pnpm check-page-endings`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docFiles, reportProblems } from './check-utils.ts'
import { pageEndingProblems } from './page-endings.ts'
import { docRelative, docsDir } from './paths.ts'

const pages = docFiles(join(docsDir, 'tutorials')).filter(
  f => !f.endsWith('CLAUDE.md'),
)
const errors = pages.flatMap(file =>
  pageEndingProblems(readFileSync(file, 'utf8')).map(
    p => `${docRelative(file)}: ${p}`,
  ),
)
reportProblems(
  errors,
  `${pages.length} tutorials close with See also, External links, Citations.`,
)
