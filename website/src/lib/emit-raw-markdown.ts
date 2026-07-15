import fs, { glob } from 'node:fs/promises'
import path from 'node:path'

import { absolutizeMarkdownLinks } from './absolutize-markdown-links.ts'

// Writes each doc's raw Markdown to `dist/docs/<slug>.md` (introduction ->
// `index.md`) at build time. This runs as an integration hook rather than an
// Astro endpoint because `.md` is a reserved Astro *page* extension: a
// `[...slug].md.ts` route collides with `trailingSlash: 'always'` (Astro
// appends `/` and the path no longer matches). The emitted files pair with the
// `/llms.txt` index and the on-page copy button (CopyMarkdown.astro); links are
// absolutized so the Markdown stays valid when read off-site.

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

// Mirror the docs loader's id/slug rules (src/content.config.ts,
// src/lib/docs-sidebar.ts) so URLs match the sidebar and llms.txt links.
function slugForDoc(rel: string, data: Record<string, string>) {
  if (data.slug === '/') {
    return 'index'
  }
  const id = rel.replace(/\.md$/, '').toLowerCase()
  return (id.endsWith('/index') ? id.slice(0, -6) : id) || 'index'
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
  for await (const rel of glob('**/*.md', { cwd: docsDir })) {
    if (path.basename(rel).startsWith('CLAUDE.md')) {
      continue
    }
    const raw = await fs.readFile(path.join(docsDir, rel), 'utf-8')
    const { data, body } = parseFrontmatter(raw)
    const slug = slugForDoc(rel, data)
    const title = data.title ?? slug
    const md = `# ${title}\n\n${absolutizeMarkdownLinks(body.trimStart(), origin)}\n`
    const out = path.join(distDir, 'docs', `${slug}.md`)
    await fs.mkdir(path.dirname(out), { recursive: true })
    await fs.writeFile(out, md)
  }
}
