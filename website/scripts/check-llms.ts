// Validates the raw-markdown surface built for LLM/agent consumption:
//   - every docs-collection page has an emitted /docs/<slug>.md (introduction
//     -> index.md), so the emit-raw-markdown build hook can't silently drift
//     from the content loader's id/slug rules (src/content.config.ts).
//   - every link in the emitted /llms.txt resolves to one of those files, so a
//     doc restructure or a new sidebar entry can't leave a dead index link.
//
// Operates on dist/ (run `pnpm build` first), like check-links. In CI this runs
// in the `buildwebsite` job right after the build. Run: `pnpm check-llms`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { isFile, reportProblems, walkFiles } from './check-utils.ts'

const docsDir = join(import.meta.dirname, '..', 'docs')
const distDir = join(import.meta.dirname, '..', 'dist')

function hasRootSlug(file: string): boolean {
  const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))
  return fm ? /^slug:\s*\/\s*$/m.test(fm[1]!) : false
}

// Emitted filename slug for a source doc — the loader's id/slug rules with
// introduction.md (`slug: /`) mapped to index. Mirrors slugForDoc in
// src/lib/emit-raw-markdown.ts and entrySlug in src/lib/docs-sidebar.ts.
function emittedSlug(rel: string, isRoot: boolean): string {
  const id = rel.replace(/\.md$/, '').toLowerCase()
  const stripped = id.endsWith('/index') ? id.slice(0, -6) : id
  return isRoot ? 'index' : stripped || 'index'
}

if (!isFile(join(distDir, 'llms.txt'))) {
  console.error('dist/ not built (no llms.txt) — run `pnpm build` first.')
  process.exit(1)
}

const problems: string[] = []

// CLAUDE.md is excluded from the docs collection (content.config.ts).
const docFiles = walkFiles(
  docsDir,
  name => name.endsWith('.md') && name !== 'CLAUDE.md',
)
const expectedSlugs = docFiles.map(full =>
  emittedSlug(full.slice(docsDir.length + 1), hasRootSlug(full)),
)
const missing = expectedSlugs.filter(
  slug => !isFile(join(distDir, 'docs', `${slug}.md`)),
)
if (missing.length > 0) {
  problems.push(
    `${missing.length} doc(s) have no emitted /docs/<slug>.md (emit-raw-markdown hook):`,
    ...missing.map(slug => `  docs/${slug}.md`),
    '',
  )
}

// Each llms.txt link is `](https://…/docs/<path>.md)`; capture the site-relative
// /docs/... part so the check is origin-independent.
const llms = readFileSync(join(distDir, 'llms.txt'), 'utf8')
const deadLinks = [
  ...llms.matchAll(/\]\((?:https?:\/\/[^)]*)?(\/docs\/[^)]*\.md)\)/g),
]
  .map(match => match[1]!)
  .filter(docsPath => !isFile(join(distDir, docsPath)))
if (deadLinks.length > 0) {
  problems.push(
    `${deadLinks.length} llms.txt link(s) do not resolve to an emitted file:`,
    ...deadLinks.map(path => `  ${path}`),
    '',
  )
}

reportProblems(
  problems,
  `All ${expectedSlugs.length} docs emitted as raw markdown; llms.txt links resolve.`,
)
