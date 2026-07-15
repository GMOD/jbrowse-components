import { SKIP, visit } from 'unist-util-visit'

import { typeNameToUrl } from './autogen-links.ts'

import type { InlineCode, Link, Root } from 'mdast'
import type { Plugin } from 'unified'

// Auto-link the first backtick mention of a documented type (e.g. `BamAdapter`)
// in a guide to its reference page. Only the first mention per type per page is
// linked, keeping the prose lightly linked rather than turning every code span
// into a link. The generated config/models pages are skipped — their type
// mentions are dense and already structurally linked — but api pages are not:
// their prose benefits from linking the config/model a documented export relates
// to (self-links and broken links can't arise, see the url guard below).
const remarkAutolinkTypes: Plugin<[], Root> = () => {
  return (tree, file) => {
    const id = typeof file.data.id === 'string' ? file.data.id : ''
    const topDir = id.split('/')[0]
    if (topDir === 'config' || topDir === 'models') {
      return
    }
    const linked = new Set<string>()
    visit(tree, 'inlineCode', (node: InlineCode, index, parent) => {
      const url = typeNameToUrl.get(node.value)
      if (
        url &&
        url !== `/docs/${id}` &&
        !linked.has(node.value) &&
        parent &&
        parent.type !== 'link' &&
        index !== undefined
      ) {
        linked.add(node.value)
        const link: Link = { type: 'link', url, children: [node] }
        parent.children[index] = link
        return [SKIP, index]
      }
    })
  }
}

export default remarkAutolinkTypes
