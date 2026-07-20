import { base, site } from 'astro:config/client'
import { getCollection } from 'astro:content'

import {
  buildSidebar,
  entrySlug,
  sidebarSections,
} from '../lib/docs-sidebar.ts'

// Emits an `/llms.txt` index (https://llmstxt.org): every doc page grouped by
// top-level sidebar section, linked to its raw `/docs/<slug>.md`. An assistant
// reads the index and fetches only the pages it needs.

// One-line orientation under a section heading, keyed by sidebar label.
// Additive: an absent or renamed key just prints its bullets, never a dead link.
const sectionNotes: Record<string, string> = {
  Configuration:
    'The config model: assemblies, then tracks; each track = one adapter (data) + display type(s), wired with JEXL. Per-type slots are under "API reference".',
  'API reference':
    'Generated config-slot reference per adapter/track/display type (BamAdapter, LinearWiggleDisplay, ...). Fetch the page for the type you are configuring.',
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
