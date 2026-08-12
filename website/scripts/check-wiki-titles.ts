// Flags a hand-written `[Title](url)` link whose text is exactly the linked
// page's own frontmatter title — that should be the wiki-style `[](url)` from
// remark-wiki-title.ts instead (src/lib/remark-wiki-title.ts), so the text
// can't drift from the target's title when it's renamed. The id/url derivation
// is the site's own (src/lib/doc-slug.ts), not a copy of it.
//
// docs/config, docs/models, docs/api are generator output (generateConfigDocs
// et al.), not hand-written, so their links are skipped — but every page,
// generated or not, is still a valid target and counts toward title lookup.
//
// A link that's flagged on purpose (the rare case where the literal title
// reads worse in context than typing it out) can suppress the check with a
// `<!-- wiki-title-ok -->` comment on the same line.
//
// Run: `pnpm check-wiki-titles`.
import { readFileSync } from 'node:fs'

import { docId, docUrl, normalizeDocUrl } from '../src/lib/doc-slug.ts'
import { docFiles, parseFrontmatter, reportProblems } from './check-utils.ts'
import { docRelative, docsDir } from './paths.ts'

const GENERATED_PREFIXES = ['config/', 'models/', 'api/']
const SUPPRESS = '<!-- wiki-title-ok -->'

const files = docFiles(docsDir)

// url ("/docs/user_guides/foo") -> title, across every doc — the same index
// src/lib/autogen-links.ts builds at render time, off the same derivation.
const titleByUrl = new Map<string, string>()
const relPathOf = new Map<string, string>()
for (const file of files) {
  const rel = docRelative(file)
  const fm = parseFrontmatter(readFileSync(file, 'utf8')) ?? {}
  relPathOf.set(file, rel)
  if (fm.title) {
    titleByUrl.set(normalizeDocUrl(docUrl(docId(rel, fm.slug))), fm.title)
  }
}

const linkRe = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g

const errorLines: string[] = []
for (const file of files) {
  const rel = relPathOf.get(file)!
  if (GENERATED_PREFIXES.some(p => rel.startsWith(p))) {
    continue
  }
  const content = readFileSync(file, 'utf8')
  content.split('\n').forEach((line, i) => {
    if (line.includes(SUPPRESS)) {
      return
    }
    for (const match of line.matchAll(linkRe)) {
      const [, bang, text, url] = match
      if (bang || !text) {
        continue
      }
      const title = titleByUrl.get(normalizeDocUrl(url!))
      if (title && title === text) {
        errorLines.push(
          `  ${rel}:${i + 1} [${text}](${url}) — reuse the target's title with [](${url}), or add ${SUPPRESS} to keep the literal text`,
        )
      }
    }
  })
}

reportProblems(
  errorLines.length > 0
    ? [
        `Found ${errorLines.length} link(s) that duplicate a title:\n`,
        ...errorLines,
      ]
    : [],
  'No links duplicate their target title.',
)
