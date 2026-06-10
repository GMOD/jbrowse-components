import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { baseUrl } from './base-url.ts'
import rehypeAdmonitions from './rehype-admonitions.ts'
import rehypeHeadingLinks from './rehype-heading-links.ts'
import rehypeTrailingSlash from './rehype-trailing-slash.ts'
import remarkFigure from './remark-figure.ts'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFigure, { base: baseUrl })
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeAdmonitions)
  .use(rehypeTrailingSlash)
  .use(rehypeSlug)
  .use(rehypeHeadingLinks)
  .use(rehypeStringify, { allowDangerousHtml: true })

export async function renderMarkdown(body: string): Promise<{ html: string }> {
  const file = await processor.process(body)
  return { html: String(file) }
}
