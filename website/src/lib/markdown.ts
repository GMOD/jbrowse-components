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
import rehypeShiki from './rehype-shiki.ts'
import rehypeTrailingSlash from './rehype-trailing-slash.ts'
import remarkAutolinkTypes from './remark-autolink-types.ts'
import remarkCodeBase from './remark-code-base.ts'
import remarkCustomHeadingId from './remark-custom-heading-id.ts'
import remarkDocList from './remark-doc-list.ts'
import remarkFigure from './remark-figure.ts'
import remarkRelatedGuides from './remark-related-guides.ts'
import remarkSpecExample from './remark-spec-example.ts'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkCustomHeadingId)
  .use(remarkFigure, { base: baseUrl })
  .use(remarkDocList)
  .use(remarkSpecExample)
  .use(remarkCodeBase)
  .use(remarkAutolinkTypes)
  .use(remarkRelatedGuides)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeShiki)
  .use(rehypeAdmonitions)
  .use(rehypeTrailingSlash)
  .use(rehypeBaseUrls, { base: baseUrl })
  .use(rehypeSlug)
  .use(rehypeCollectToc)
  .use(rehypeHeadingLinks)
  .use(rehypeStringify, { allowDangerousHtml: true })

export async function renderMarkdown(
  body: string,
  id = '',
): Promise<{ html: string; toc: TocItem[] }> {
  await ensureAutogenIndex()
  const file = await processor.process({ value: body, data: { id } })
  return { html: String(file), toc: (file.data.toc as TocItem[] | undefined) ?? [] }
}
