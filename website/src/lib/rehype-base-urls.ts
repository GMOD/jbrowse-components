import { visit } from 'unist-util-visit'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

function shouldPrefix(url: unknown, base: string): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('/') &&
    !url.startsWith('//') &&
    url !== base &&
    !url.startsWith(`${base}/`)
  )
}

// markdown content references other pages/images with root-relative URLs
// like `/docs/...` or `/img/...`; prefix those with the configured base path
// (e.g. `/jb2`) so they resolve correctly both in `astro dev` and the built site
const rehypeBaseUrls: Plugin<[{ base: string }], Root> = ({ base }) => {
  return tree => {
    if (!base) {
      return
    }
    visit(tree, 'element', node => {
      const prop =
        node.tagName === 'a' ? 'href' : node.tagName === 'img' ? 'src' : null
      const url = prop && node.properties[prop]
      if (prop && shouldPrefix(url, base)) {
        node.properties[prop] = `${base}${url}`
      }
    })
  }
}

export default rehypeBaseUrls
