// A reference doc the site should send a reader to, that no site page links.
//
// `agent-docs/reference/` holds two kinds of doc and nothing separated them.
// Some are for whoever is editing this repo — a figure harness, a CI gate, a
// linter split, an audit — and a site page linking one would be sending a
// reader somewhere they cannot act. The rest document behaviour a JBrowse user
// or a plugin author can hit, and those are only useful if a page points at
// them.
//
// Nothing distinguished the two, so "cited by nobody" read the same either way.
// RENDERER_BENCHMARKS.md is what that costs: the only whole-app measurement
// against a released JBrowse, with the caveat that stops it being quoted as a
// speedup, and no page under `website/docs/` linked it — while
// `optimizations.md` opened by saying everything on it was measured.
//
// The fix is the one `sync-measurements` already uses for an orphaned
// measurement record: the doc says which kind it is rather than the check
// inferring it from an absence. `audience: internal` in the frontmatter is that
// decision written down.
//
// ## The ratchet
//
// Marking a doc internal is cheap and wrong is silent, so the other half — a
// citeable doc nobody cites — cannot simply be an error today: thirteen of
// them predate this check, and several want an editorial pass rather than a
// link dropped at the bottom of a page. So it ratchets, the way
// `sync-doc-snippets` does for un-included fences: the uncited count may fall
// and may not rise. A NEW reference doc is therefore cited, marked internal, or
// red, which is the case this exists for.
import { readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

import {
  docFiles,
  linkedAgentDocs,
  parseFrontmatter,
  reportProblems,
  walkFiles,
} from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'

const UNCITED_BASELINE = Number(process.env.REFERENCE_UNCITED_BASELINE ?? '13')

const AUDIENCES = new Set(['internal'])

const referenceDir = join(repoRoot, 'agent-docs', 'reference')

// The generated index of this directory. It cites every doc here and no page
// cites it, which is correct in both directions and not a judgement any
// frontmatter should have to carry.
const SELF_INDEX = 'README.md'

const cited = new Set<string>()
for (const path of docFiles(docsDir)) {
  for (const doc of linkedAgentDocs(readFileSync(path, 'utf8'))) {
    cited.add(doc)
  }
}

const problems: string[] = []
const uncited: string[] = []

for (const path of walkFiles(referenceDir, n => n.endsWith('.md'))) {
  const name = basename(path)
  if (name === SELF_INDEX) {
    continue
  }
  const rel = relative(repoRoot, path)
  const audience = parseFrontmatter(readFileSync(path, 'utf8'))?.audience
  const isCited = cited.has(rel)

  if (audience !== undefined && !AUDIENCES.has(audience)) {
    problems.push(
      `${rel}: audience "${audience}" is not a value this check knows. The only one is "internal" — anything else has to earn a citation.`,
    )
    continue
  }

  // Both halves wrong at once, and either could be the wrong one: a page grew a
  // link to a doc marked internal, or a doc that always was site-facing kept
  // the flag. Naming both is the whole report.
  if (audience === 'internal' && isCited) {
    problems.push(
      `${rel}: marked "audience: internal" and linked by a site page. Drop the flag if the doc is site-facing, or drop the link if the reader cannot act on it.`,
    )
    continue
  }

  if (audience === undefined && !isCited) {
    uncited.push(rel)
  }
}

if (uncited.length > UNCITED_BASELINE) {
  problems.push(
    `${uncited.length} reference doc(s) are cited by no page under website/docs, above the baseline of ${UNCITED_BASELINE}:
${uncited.map(r => `  ${r}`).join('\n')}
Link it from the page that owns the subject, or add "audience: internal" to its frontmatter if a reader of the site could not act on it.`,
  )
}

reportProblems(
  problems,
  uncited.length < UNCITED_BASELINE
    ? `${uncited.length} reference doc(s) uncited (baseline ${UNCITED_BASELINE}) — lower REFERENCE_UNCITED_BASELINE to ${uncited.length} to hold the gain.`
    : `every reference doc is cited by a site page or marked internal, bar the ${uncited.length} in the baseline.`,
)
