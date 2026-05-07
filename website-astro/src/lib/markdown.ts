import type { MarkdownHeading } from 'astro'
import type { Element, Root, RootContent } from 'hast'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import remarkFigure from './remark-figure.ts'
import rehypeAdmonitions from './rehype-admonitions.ts'
import rehypeTrailingSlash from './rehype-trailing-slash.ts'
import rehypeHeadingLinks from './rehype-heading-links.ts'
import { getText } from './hast-utils.ts'

function extractHeadings(tree: Root): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  visit(tree, 'element', node => {
    if (!/^h[1-6]$/.test(node.tagName)) {
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
  .use(remarkFigure)
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
