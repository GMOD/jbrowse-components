// Finds a comment that says a name "was" something the same file still
// declares — the shape a rename leaves when it sweeps the sentence recording
// itself. `renameArchaeology.ts` carries why this is invisible to everything
// else; run: `pnpm check-rename-archaeology`, or the root `pnpm check-docs`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems, walkFiles } from './check-utils.ts'
import { repoRoot } from './paths.ts'
import { findRenameArchaeology } from './renameArchaeology.ts'

const BUILD_DIRS = new Set(['node_modules', 'dist', 'esm', 'cjs', 'build'])
const ROOTS = ['packages', 'plugins', 'products', 'scripts', 'website/scripts']

// A file whose subject IS a retired name, where the idiom is the content rather
// than a slip. Keep each entry pinned to what makes it legitimate.
const ALLOW = new Set<string>([
  // This detector's own tests. Their fixtures are the thing being detected —
  // a rename sentence and the declaration it wrongly names, in one string — so
  // the file triggers on itself by construction. `renameArchaeology.test.ts`
  // covers the behaviour instead, including the case this exemption hides.
  'website/scripts/renameArchaeology.test.ts',
])

const problems: string[] = []
for (const base of ROOTS) {
  for (const file of walkFiles(
    join(repoRoot, base),
    n => /\.(tsx?|mjs)$/.test(n),
    BUILD_DIRS,
  )) {
    const rel = file.slice(repoRoot.length + 1)
    if (ALLOW.has(rel)) {
      continue
    }
    for (const hit of findRenameArchaeology(readFileSync(file, 'utf8'))) {
      problems.push(
        `  ${rel}:${hit.line}`,
        `    ${hit.text}`,
        `    → \`${hit.name}\` is declared in this file, so it cannot be what` +
          ` the name used to be. A rename rewrote the sentence recording it;` +
          ` restore the OLD name.\n`,
      )
    }
  }
}

reportProblems(
  problems.length > 0
    ? [
        `Found ${problems.length / 3} rename sentence(s) naming a live local:\n`,
        ...problems,
      ]
    : [],
  'No comment claims a live local name is what something used to be called.',
)
