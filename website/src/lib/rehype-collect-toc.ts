import { visit } from 'unist-util-visit'

import { getText } from './hast-utils.ts'

import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

export interface TocItem {
  depth: number
  id: string
  text: string
}

const HEADING_DEPTHS: Record<string, number> = { h2: 2, h3: 3 }

// Collects h2/h3 headings (with the ids that rehypeSlug assigned) into
// file.data.toc so the layout can render a right-hand table of contents. Must
// run after rehypeSlug and before rehypeHeadingLinks (which appends a "#"
// anchor we don't want in the label).
const rehypeCollectToc: Plugin<[], Root> = () => {
  return (tree, file) => {
    const toc: TocItem[] = []
    visit(tree, 'element', (node: Element) => {
      const depth = HEADING_DEPTHS[node.tagName]
      const id = node.properties.id
      if (depth && id) {
        toc.push({ depth, id, text: getText(node) })
      }
    })
    file.data.toc = toc
  }
}

export default rehypeCollectToc
