// Flags a hand-written `[Title](url)` link whose text is exactly the linked
// page's own frontmatter title — that should be the wiki-style `[](url)` from
// remark-wiki-title.ts instead (src/lib/remark-wiki-title.ts), so the text
// can't drift from the target's title when it's renamed. Mirrors the id/url
// derivation in src/content.config.ts and src/lib/docs-sidebar.ts#entrySlug.
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
import { join } from 'node:path'

import { reportProblems, walkFiles } from './check-utils.ts'

const docsDir = join(import.meta.dirname, '..', 'docs')
const GENERATED_PREFIXES = ['config/', 'models/', 'api/']
const SUPPRESS = '<!-- wiki-title-ok -->'

function parseFrontmatter(content: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(content)
  if (!m) {
    return {}
  }
  const fm: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line)
    if (kv) {
      fm[kv[1]!] = kv[2]!.trim().replaceAll(/^["']|["']$/g, '')
    }
  }
  return fm
}

// Mirrors entrySlug() in src/lib/docs-sidebar.ts.
function entrySlug(id: string): string {
  if (id === 'index') {
    return ''
  }
  return id.endsWith('/index') ? id.slice(0, -6) : id
}

const files = walkFiles(
  docsDir,
  name => name.endsWith('.md') && name !== 'CLAUDE.md',
)

// url ("/docs/user_guides/foo") -> title, across every doc — mirrors the
// titleByUrl index in src/lib/autogen-links.ts.
const titleByUrl = new Map<string, string>()
const relPathOf = new Map<string, string>()
for (const file of files) {
  const rel = file.slice(docsDir.length + 1)
  const content = readFileSync(file, 'utf8')
  const fm = parseFrontmatter(content)
  const id = fm.slug === '/' ? 'index' : rel.replace(/\.md$/, '').toLowerCase()
  relPathOf.set(file, rel)
  if (fm.title) {
    titleByUrl.set(`/docs/${entrySlug(id)}`, fm.title)
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
      const normUrl = url!.replace(/#.*$/, '').replace(/\/$/, '')
      const title = titleByUrl.get(normUrl)
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
