import fs, { glob } from 'node:fs/promises'
import path from 'node:path'

import { absolutizeMarkdownLinks } from './absolutize-markdown-links.ts'
import { retargetCodeBaseInMarkdown } from './code-base.ts'
import { docId, docUrl, normalizeDocUrl, slugFilename } from './doc-slug.ts'
import { plainReferenceMarkdown } from './plain-reference-markdown.ts'
import { seeAlsoMarkdown } from './remark-see-also.ts'
import { tutorialBetaNotice } from './tutorial-beta-notice.ts'

// Each doc's raw Markdown, served at `/docs/<slug>.md` (introduction ->
// `index.md`): written into dist at build time and served by the dev server.
// An integration hook rather than an Astro endpoint because `.md` is a reserved
// Astro page extension, and a `[...slug].md.ts` route collides with
// `trailingSlash: 'always'`. The files back `/llms.txt` and the on-page copy
// button (CopyMarkdown.astro); links are absolutized so the Markdown stays
// valid when read off-site.

// Minimal frontmatter read: only `title` and `slug` are needed, both
// single-line. Indented continuation lines (e.g. a wrapped `description`) start
// with whitespace and don't match `^(\w+):`, so they're correctly ignored.
function parseFrontmatter(raw: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  const data: Record<string, string> = {}
  if (match) {
    for (const line of match[1]!.split(/\r?\n/)) {
      const kv = /^(\w+):\s*(.*)$/.exec(line)
      if (kv) {
        data[kv[1]!] = kv[2]!.trim().replaceAll(/^['"]|['"]$/g, '')
      }
    }
  }
  return { data, body: match ? match[2]! : raw }
}

export async function rawDocPages({
  docsDir,
  origin,
}: {
  docsDir: string
  origin: string
}) {
  const pages = []
  const titles = new Map<string, string>()
  for await (const rel of glob('**/*.md', { cwd: docsDir })) {
    if (!path.basename(rel).startsWith('CLAUDE.md')) {
      const raw = await fs.readFile(path.join(docsDir, rel), 'utf-8')
      const { data, body } = parseFrontmatter(raw)
      const id = docId(rel, data.slug)
      const slug = slugFilename(id)
      const title = data.title ?? slug
      titles.set(normalizeDocUrl(docUrl(id)), title)
      pages.push({ rel, body, slug, title })
    }
  }
  const out = new Map<string, string>()
  for (const { rel, body, slug, title } of pages) {
    const notice =
      tutorialBetaNotice && slug.startsWith('tutorials/')
        ? `${tutorialBetaNotice}\n\n`
        : ''
    const text = /^(config|models)\//.test(rel)
      ? plainReferenceMarkdown(body)
      : body
    const linked = seeAlsoMarkdown(text, url => titles.get(url))
    out.set(
      slug,
      `# ${title}\n\n${retargetCodeBaseInMarkdown(absolutizeMarkdownLinks(notice + linked.trimStart(), origin))}\n`,
    )
  }
  return out
}

export async function emitRawMarkdown({
  docsDir,
  distDir,
  origin,
}: {
  docsDir: string
  distDir: string
  origin: string
}) {
  for (const [slug, md] of await rawDocPages({ docsDir, origin })) {
    const out = path.join(distDir, 'docs', `${slug}.md`)
    await fs.mkdir(path.dirname(out), { recursive: true })
    await fs.writeFile(out, md)
  }
}
