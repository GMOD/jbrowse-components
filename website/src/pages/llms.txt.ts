import { base, site } from 'astro:config/client'
import { getCollection } from 'astro:content'

import { buildSidebar, entrySlug, sidebarSections } from '../lib/docs-sidebar.ts'

// Emits an `/llms.txt` index (https://llmstxt.org) listing every doc page,
// grouped by its top-level sidebar section and linked to the page's raw
// `/docs/<slug>.md` endpoint. An assistant reads this index, then fetches only
// the raw pages it needs — no pre-concatenated full-text dump.

// One-line orientation printed under a section heading, keyed by the section's
// sidebar label. Purely additive: a section with no entry here (or a renamed
// one) just prints its bullets, so this can't leave a dead link — it only ever
// understates. Config is where readers most need the map: concepts live under
// "Configuration", the exhaustive per-type slot reference under "API reference".
const sectionNotes: Record<string, string> = {
  Configuration:
    'How a config.json is structured — assemblies, then tracks, each with an adapter (data) and one or more display types, wired with JEXL callbacks. Read these for the model; look up an exact type in "API reference".',
  'API reference':
    'Auto-generated config-slot reference for every adapter, track, and display type (e.g. BamAdapter, LinearWiggleDisplay). Fetch the one page for the type you are configuring to see its available slots.',
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
  const sections = sidebarSections(sidebar, slug => docSlugs.has(slug)).map(
    section => {
      const note = sectionNotes[section.label]
      const bullets = section.links
        .map(link => `- [${link.label}](${mdUrl(link.slug)})`)
        .join('\n')
      return `## ${section.label}\n\n${note ? `${note}\n\n` : ''}${bullets}`
    },
  )

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
