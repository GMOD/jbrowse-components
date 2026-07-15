import { type DocListEntry, docsInDir } from './autogen-links.ts'

import type { List, ListItem, PhrasingContent, Root } from 'mdast'
import type { Plugin } from 'unified'

// Replaces a `<!-- doclist:<dir> -->` marker with a bullet list of every page
// under that top-level docs dir, each rendered as "[title](url) — description"
// from frontmatter. Keeps an index page (introduction.md) from hand-mirroring a
// directory's titles/descriptions, which then drift as pages are added.
const markerRe = /^<!--\s*doclist:([a-z0-9_-]+)\s*-->$/

function listItem(entry: DocListEntry): ListItem {
  const children: PhrasingContent[] = [
    {
      type: 'link',
      url: entry.url,
      children: [{ type: 'text', value: entry.title }],
    },
  ]
  if (entry.description) {
    children.push({ type: 'text', value: ` — ${entry.description}` })
  }
  return {
    type: 'listItem',
    spread: false,
    children: [{ type: 'paragraph', children }],
  }
}

const remarkDocList: Plugin<[], Root> = () => tree => {
  tree.children.forEach((node, i) => {
    const match = node.type === 'html' ? markerRe.exec(node.value.trim()) : null
    if (match) {
      const entries = docsInDir(match[1]!)
      // A marker resolving to nothing is a typo'd dir (e.g. `doclist:tutorial`),
      // not a real empty directory — fail the build rather than silently
      // rendering an empty list.
      if (entries.length === 0) {
        throw new Error(`<!-- doclist:${match[1]} --> matched no docs`)
      }
      const list: List = {
        type: 'list',
        ordered: false,
        spread: false,
        children: entries.map(listItem),
      }
      tree.children[i] = list
    }
  })
}

export default remarkDocList
