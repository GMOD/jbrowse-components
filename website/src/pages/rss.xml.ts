import { getCollection } from 'astro:content'

import { baseUrl } from '../lib/base-url.ts'
import { blogPath } from '../lib/blog-path.ts'
import { renderMarkdown } from '../lib/markdown.ts'

import type { APIRoute } from 'astro'

const CHANNEL_TITLE = 'JBrowse Blog'
const CHANNEL_DESCRIPTION =
  'Release announcements and news from the JBrowse project.'
// Match the blog index excerpt length so the feed shows the same preview.
const EXCERPT_CHARS = 600
const MAX_ITEMS = 20

function escapeXml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(`${baseUrl}/${p}`, site).href

  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  )

  const items = await Promise.all(
    posts.slice(0, MAX_ITEMS).map(async post => {
      const link = abs(`blog/${blogPath(post)}/`)
      const body = post.body ?? ''
      const excerpt =
        body.length > EXCERPT_CHARS ? body.slice(0, EXCERPT_CHARS) : body
      const { html } = await renderMarkdown(excerpt)
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${post.data.date.toUTCString()}</pubDate>${
        post.data.author
          ? `\n      <author>${escapeXml(post.data.author)}</author>`
          : ''
      }${(post.data.tags ?? [])
        .map(t => `\n      <category>${escapeXml(t)}</category>`)
        .join('')}
      <description><![CDATA[${html}]]></description>
    </item>`
    }),
  )

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${CHANNEL_TITLE}</title>
    <link>${abs('blog/')}</link>
    <description>${CHANNEL_DESCRIPTION}</description>
    <language>en-us</language>
    <atom:link href="${abs('rss.xml')}" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>
`

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
