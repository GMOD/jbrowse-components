import { visit } from 'unist-util-visit'

import { titleForUrl } from './autogen-links.ts'

import type { Link, Root } from 'mdast'
import type { Plugin } from 'unified'

// A link with empty text — `[](/docs/user_guides/foo)` — resolves, wiki-style,
// to the linked page's own frontmatter title. Lets "See also" bullets and
// similar cross-links reuse a page's title without retyping it, so the title
// can't drift out of sync when the target page is renamed.
const remarkWikiTitle: Plugin<[], Root> = () => {
  return (tree, file) => {
    visit(tree, 'link', (node: Link) => {
      if (node.children.length > 0) {
        return
      }
      const title = titleForUrl(node.url)
      if (!title) {
        throw new Error(
          `${file.data.id}: empty-text link to unresolvable page: ${node.url}`,
        )
      }
      node.children = [{ type: 'text', value: title }]
    })
  }
}

export default remarkWikiTitle
