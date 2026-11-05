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

const URL_PROPS: Record<string, string> = {
  a: 'href',
  img: 'src',
  source: 'src',
  track: 'src',
  video: 'poster',
}

// markdown content references other pages, images and media with
// root-relative URLs like `/docs/...` or `/img/...`; prefix those with the
// configured base path (e.g. `/jb2`) so they resolve correctly both in
// `astro dev` and the built site
const rehypeBaseUrls: Plugin<[{ base: string }], Root> = ({ base }) => {
  return tree => {
    if (base) {
      visit(tree, 'element', node => {
        const prop = URL_PROPS[node.tagName]
        const url = prop ? node.properties[prop] : undefined
        if (prop && shouldPrefix(url, base)) {
          node.properties[prop] = `${base}${url}`
        }
      })
    }
  }
}

export default rehypeBaseUrls
