import { visit } from 'unist-util-visit'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

// Support the `## Heading {#custom-id}` syntax (Docusaurus/GFM-style explicit
// heading ids). The trailing `{#id}` is stripped from the rendered text and
// applied as the heading's id; rehypeSlug then leaves that id untouched (it
// only slugs headings without an existing id).
const CUSTOM_ID = /\s*\{#([\w-]+)\}\s*$/

const remarkCustomHeadingId: Plugin<[], Root> = () => {
  return tree => {
    visit(tree, 'heading', node => {
      const last = node.children.at(-1)
      if (last?.type === 'text') {
        const match = CUSTOM_ID.exec(last.value)
        if (match) {
          last.value = last.value.replace(CUSTOM_ID, '')
          node.data = {
            ...node.data,
            hProperties: { ...node.data?.hProperties, id: match[1] },
          }
        }
      }
    })
  }
}

export default remarkCustomHeadingId
