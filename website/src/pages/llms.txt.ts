import { base, site } from 'astro:config/client'
import { getCollection } from 'astro:content'

import { buildSidebar, entrySlug } from '../lib/docs-sidebar.ts'

import type { SidebarEntry, SidebarLink } from '../lib/docs-sidebar.ts'

// Emits an `/llms.txt` index (https://llmstxt.org) listing every doc page,
// grouped by its top-level sidebar section and linked to the page's raw
// `/docs/<slug>.md` endpoint.
function flattenLinks(entry: SidebarEntry): SidebarLink[] {
  return entry.type === 'link' ? [entry] : entry.items.flatMap(flattenLinks)
}

export async function GET() {
  const baseUrl = base.replace(/\/$/, '')
  const origin = `${site ?? ''}${baseUrl}`
  const mdUrl = (slug: string) => `${origin}/docs/${slug || 'index'}.md`

  const docs = await getCollection('docs')
  // Sidebar can include `link`-type entries to landing pages that aren't doc
  // collection entries (e.g. /docs/tutorials/); those have no raw `.md`, so
  // restrict to real doc slugs.
  const docSlugs = new Set(docs.map(d => entrySlug(d.id)))
  const sidebar = buildSidebar(docs, baseUrl)
  const seen = new Set<string>()
  const sections = sidebar
    .map(entry => {
      const label = entry.type === 'group' ? entry.label : 'General'
      const bullets = flattenLinks(entry)
        .filter(link => docSlugs.has(link.slug))
        .filter(link => {
          const fresh = !seen.has(link.slug)
          seen.add(link.slug)
          return fresh
        })
        .map(link => `- [${link.label}](${mdUrl(link.slug)})`)
      return bullets.length ? `## ${label}\n\n${bullets.join('\n')}` : ''
    })
    .filter(Boolean)

  const header = [
    '# JBrowse 2 Documentation',
    '',
    '> JBrowse 2 is a pluggable, open-source genome browser that runs as a web app, a desktop app, and as embeddable React components, with linear, circular, dotplot, synteny, and spreadsheet views.',
    '',
    'Each link points to the raw Markdown for that documentation page.',
  ].join('\n')

  return new Response(`${header}\n\n${sections.join('\n\n')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
