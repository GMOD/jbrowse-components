import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { ensureAutogenIndex } from './autogen-links.ts'
import { baseUrl } from './base-url.ts'
import rehypeAdmonitions from './rehype-admonitions.ts'
import rehypeBaseUrls from './rehype-base-urls.ts'
import rehypeCollectToc, { type TocItem } from './rehype-collect-toc.ts'
import rehypeHeadingLinks from './rehype-heading-links.ts'
import rehypeLightbox from './rehype-lightbox.ts'
import rehypeShiki from './rehype-shiki.ts'
import rehypeTrailingSlash from './rehype-trailing-slash.ts'
import remarkAutolinkTypes from './remark-autolink-types.ts'
import remarkCodeBase from './remark-code-base.ts'
import remarkConfigCliTabs from './remark-config-cli-tabs.ts'
import remarkCustomHeadingId from './remark-custom-heading-id.ts'
import remarkDocList from './remark-doc-list.ts'
import remarkFigure from './remark-figure.ts'
import remarkRelatedGuides from './remark-related-guides.ts'
import remarkSpecExample from './remark-spec-example.ts'
import remarkVideo from './remark-video.ts'
import remarkWikiTitle from './remark-wiki-title.ts'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkCustomHeadingId)
  .use(remarkConfigCliTabs)
  .use(remarkFigure, { base: baseUrl })
  .use(remarkVideo, { base: baseUrl })
  .use(remarkDocList)
  .use(remarkSpecExample)
  .use(remarkCodeBase)
  .use(remarkAutolinkTypes)
  .use(remarkWikiTitle)
  .use(remarkRelatedGuides)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeShiki)
  .use(rehypeLightbox)
  .use(rehypeAdmonitions)
  .use(rehypeTrailingSlash)
  .use(rehypeBaseUrls, { base: baseUrl })
  .use(rehypeSlug)
  .use(rehypeCollectToc)
  .use(rehypeHeadingLinks)
  .use(rehypeStringify, { allowDangerousHtml: true })

// `feed` renders for the RSS feed, where page-only interactivity (the lightbox
// wrapper around images) is markup a feed reader can only strip or mangle.
export async function renderMarkdown(
  body: string,
  id = '',
  { feed = false }: { feed?: boolean } = {},
): Promise<{ html: string; toc: TocItem[] }> {
  await ensureAutogenIndex()
  const file = await processor.process({ value: body, data: { id, feed } })
  return {
    html: String(file),
    toc: (file.data.toc as TocItem[] | undefined) ?? [],
  }
}
