import { visit } from 'unist-util-visit'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

const HAS_EXTENSION = /\.[a-z0-9]+$/i

// Root-relative page links get a trailing slash to match Astro's
// `trailingSlash: 'always'`. Split off any `?query`/`#fragment` first and add
// the slash to the *path* only — appending it blindly turns an authored
// `/docs/page/#anchor` into a broken `/docs/page//#anchor`.
const rehypeTrailingSlash: Plugin<[], Root> = () => {
  return tree => {
    visit(tree, 'element', node => {
      const href = node.properties.href
      if (
        node.tagName === 'a' &&
        typeof href === 'string' &&
        href.startsWith('/') &&
        !href.startsWith('//')
      ) {
        const suffixIdx = href.search(/[?#]/)
        const path = suffixIdx === -1 ? href : href.slice(0, suffixIdx)
        const suffix = suffixIdx === -1 ? '' : href.slice(suffixIdx)
        if (!path.endsWith('/') && !HAS_EXTENSION.test(path)) {
          node.properties.href = `${path}/${suffix}`
        }
      }
    })
  }
}

export default rehypeTrailingSlash
