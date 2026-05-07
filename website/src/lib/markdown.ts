import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { baseUrl } from './base-url.ts'
import { getText } from './hast-utils.ts'
import rehypeAdmonitions from './rehype-admonitions.ts'
import rehypeHeadingLinks from './rehype-heading-links.ts'
import rehypeTrailingSlash from './rehype-trailing-slash.ts'
import remarkFigure from './remark-figure.ts'

import type { MarkdownHeading } from 'astro'
import type { Root, RootContent } from 'hast'

const headingRe = /^h[1-6]$/

function extractHeadings(tree: Root): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  visit(tree, 'element', node => {
    if (!headingRe.test(node.tagName)) {
      return
    }
    const slug = node.properties?.id as string | undefined
    if (slug) {
      headings.push({
        depth: parseInt(node.tagName[1]),
        slug,
        text: getText(node as RootContent),
      })
    }
  })
  return headings
}

const processor = unified()
  .use(remarkParse)
  .use(remarkFigure, { base: baseUrl })
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeAdmonitions)
  .use(rehypeTrailingSlash)
  .use(rehypeSlug)
  .use(rehypeHeadingLinks)
  .use(rehypeStringify, { allowDangerousHtml: true })

export async function renderMarkdown(
  body: string,
): Promise<{ html: string; headings: MarkdownHeading[] }> {
  const tree = processor.parse(body)
  const hast = await processor.run(tree)
  const headings = extractHeadings(hast as Root)
  const html = processor.stringify(hast as Root) as string
  return { html, headings }
}
