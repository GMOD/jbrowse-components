import { getCollection } from 'astro:content'

import { baseUrl } from '../lib/base-url.ts'
import { blogPath } from '../lib/blog-path.ts'
import { entrySlug } from '../lib/docs-sidebar.ts'
import { navLinks } from '../lib/nav.ts'

import type { APIRoute } from 'astro'

// Standalone routes that aren't part of a content collection: the shared nav
// pages plus home, search, and the footer-only cancer page.
const staticRoutes = [...navLinks.map(l => l.path), '', 'search', 'cancer']

export const GET: APIRoute = async ({ site }) => {
  // trailingSlash: 'always' — normalize every loc to end with '/'
  const loc = (p: string) => {
    const href = new URL(`${baseUrl}/${p}`, site).href
    return href.endsWith('/') ? href : `${href}/`
  }

  const docs = await getCollection('docs')
  const blog = await getCollection('blog')

  const paths = [
    ...staticRoutes,
    ...docs.map(d => {
      const slug = entrySlug(d.id)
      return slug ? `docs/${slug}/` : 'docs/'
    }),
    ...blog.map(post => `blog/${blogPath(post)}/`),
  ]

  const locs = [...new Set(paths.map(loc))]
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map(l => `  <url><loc>${l}</loc></url>`).join('\n')}
</urlset>
`

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
