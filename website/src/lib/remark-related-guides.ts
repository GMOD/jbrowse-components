import { backlinksFor, relatedGuidesFor } from './autogen-links.ts'

import type { Heading, List, Root } from 'mdast'
import type { Plugin } from 'unified'

// Append a "Related guides" footer to each page. Reference pages
// (config/models/api) list the guides that link to them — the backlink
// direction the autogen otherwise lacks. Guides list sibling guides that cite
// the same reference pages.
const remarkRelatedGuides: Plugin<[], Root> = () => {
  return (tree, file) => {
    const id = typeof file.data.id === 'string' ? file.data.id : ''
    const topDir = id.split('/')[0]
    const isAutogen =
      topDir === 'config' || topDir === 'models' || topDir === 'api'
    const links = isAutogen ? backlinksFor(id) : relatedGuidesFor(id)
    if (links.length === 0) {
      return
    }
    const heading: Heading = {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: 'Related guides' }],
    }
    const list: List = {
      type: 'list',
      ordered: false,
      spread: false,
      children: links.map(({ title, url }) => ({
        type: 'listItem',
        spread: false,
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'link', url, children: [{ type: 'text', value: title }] },
            ],
          },
        ],
      })),
    }
    tree.children.push(heading, list)
  }
}

export default remarkRelatedGuides
