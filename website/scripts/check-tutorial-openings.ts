// Every tutorial's opening, by `tutorialOpeningProblems`.
//
// Run: `pnpm check-tutorial-openings`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docFiles, reportProblems } from './check-utils.ts'
import { docRelative, docsDir } from './paths.ts'
import { tutorialOpeningProblems } from './tutorial-openings.ts'

const pages = docFiles(join(docsDir, 'tutorials')).filter(
  f => !f.endsWith('CLAUDE.md'),
)
const errors = pages.flatMap(file =>
  tutorialOpeningProblems(readFileSync(file, 'utf8')).map(
    p => `${docRelative(file)}: ${p}`,
  ),
)
reportProblems(
  errors,
  `${pages.length} tutorials open on a list of what the page does.`,
)
