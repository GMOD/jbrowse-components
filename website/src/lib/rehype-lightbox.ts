import { SKIP, visit } from 'unist-util-visit'

import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

// Make every markdown image enlarge in the site lightbox rather than doing
// nothing (blog screenshots) — doc figures already come out of remark-figure
// wrapped, and an image inside a link keeps the link. Runs after rehype-raw so
// the raw <figure> HTML remark-figure emits is parsed hast by the time we look
// at it.
const rehypeLightbox: Plugin<[], Root> = () => (tree, file) => {
  visit(tree, 'element', (node: Element, index, parent) => {
    if (
      // the RSS feed renders the same markdown but has no lightbox to open, so
      // a button there is markup a feed reader can only strip or mangle
      file.data.feed !== true &&
      node.tagName === 'img' &&
      parent?.type === 'element' &&
      parent.tagName !== 'a' &&
      parent.tagName !== 'button' &&
      index !== undefined
    ) {
      const alt =
        typeof node.properties.alt === 'string' ? node.properties.alt : ''
      parent.children[index] = {
        type: 'element',
        tagName: 'button',
        properties: {
          type: 'button',
          className: ['lightbox-trigger'],
          'aria-label': alt ? `Enlarge: ${alt}` : 'Enlarge image',
        },
        children: [node],
      }
      return [SKIP, index + 1]
    }
  })
}

export default rehypeLightbox
