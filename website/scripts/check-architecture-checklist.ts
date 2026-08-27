// The CLI over `architecture-checklist-rules.ts`, which carries the rules and
// the reason they exist. Run by `pnpm check-docs`.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { checkArchitectureDoc } from './architecture-checklist-rules.ts'
import { reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'

const archPath = join(repoRoot, 'agent-docs', 'ARCHITECTURE.md')
const archDir = dirname(archPath)

const { entryCount, problems } = checkArchitectureDoc({
  doc: readFileSync(archPath, 'utf8'),
  readLink: path => {
    const resolved = join(archDir, path)
    return existsSync(resolved)
      ? path.endsWith('.md')
        ? readFileSync(resolved, 'utf8')
        : ''
      : undefined
  },
})

reportProblems(
  problems,
  `${entryCount} "What not to do" entries all name a destination, every link in ARCHITECTURE.md resolves, and every section is indexed or declared to carry no rule`,
)
