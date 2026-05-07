import { visit } from 'unist-util-visit'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

const HAS_EXTENSION = /\.[a-z0-9]+$/i
const IS_ABSOLUTE_INTERNAL = /^\//

const rehypeTrailingSlash: Plugin<[], Root> = () => {
  return tree => {
    visit(tree, 'element', node => {
      if (node.tagName !== 'a') {
        return
      }
      const href = node.properties?.href
      if (
        typeof href === 'string' &&
        href.startsWith("/") &&
        !href.includes('://') &&
        !HAS_EXTENSION.test(href.split('#')[0].split('?')[0]) &&
        !href.endsWith('/')
      ) {
        node.properties.href = href.replace(/(#.*)?$/, '/$1')
      }
    })
  }
}

export default rehypeTrailingSlash
