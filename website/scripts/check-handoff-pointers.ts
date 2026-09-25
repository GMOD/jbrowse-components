// Every handoff names what is unfinished rather than where someone was doing
// it. `handoffPointers.ts` carries the reasoning, including why naming a commit
// stays legal.
//
// Run: `pnpm check-handoff-pointers`
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { docFiles, reportProblems } from './check-utils.ts'
import { findHandoffPointers } from './handoffPointers.ts'
import { repoRoot } from './paths.ts'

const problems = docFiles(join(repoRoot, 'agent-docs', 'handoffs'))
  .filter(file => !file.endsWith('README.md'))
  .sort()
  .flatMap(file =>
    findHandoffPointers(readFileSync(file, 'utf8')).map(
      ({ line, token, what }) =>
        `${relative(repoRoot, file)}:${line}: names ${what}, \`${token}\` — gone once the thread lands, and unreachable from any other machine before that. Say what is unfinished; git holds who did it where.`,
    ),
  )

reportProblems(problems, 'No handoff points at a branch or a worktree')
