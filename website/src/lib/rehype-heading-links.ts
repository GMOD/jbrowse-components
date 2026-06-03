import { visit } from 'unist-util-visit'

import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

const HEADING_TAGS = new Set(['h2', 'h3', 'h4'])

const rehypeHeadingLinks: Plugin<[], Root> = () => {
  return tree => {
    visit(tree, 'element', (node: Element) => {
      if (!HEADING_TAGS.has(node.tagName)) {
        return
      }
      const id = node.properties?.id as string | undefined
      if (!id) {
        return
      }
      const anchor: Element = {
        type: 'element',
        tagName: 'a',
        properties: {
          href: `#${id}`,
          className: ['heading-anchor'],
          ariaHidden: 'true',
          tabIndex: -1,
        },
        children: [{ type: 'text', value: '#' }],
      }
      node.children = [...node.children, anchor]
    })
  }
}

export default rehypeHeadingLinks
