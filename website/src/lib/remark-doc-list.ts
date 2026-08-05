import {
  type DocListEntry,
  docsInCategory,
  docsInDir,
  docsInDirGrouped,
} from './autogen-links.ts'

import type { Heading, List, ListItem, PhrasingContent, Root } from 'mdast'
import type { Plugin } from 'unified'

// Replaces a `<!-- doclist:<dir> -->` marker with a bullet list of every page
// under that top-level docs dir, each rendered as "[title](url) — description"
// from frontmatter. Keeps an index page (introduction.md) from hand-mirroring a
// directory's titles/descriptions, which then drift as pages are added.
//
// Flags (space-separated, any order):
//   nodesc            list titles only, omitting descriptions
//   grouped           bucket entries by category under `### <Category>`
//                     headings (for the config/models reference index pages)
//   category="Name"   list only the pages in that one category, in the
//                     sidebar's order. A guide page uses this to point at the
//                     rest of its own section without hand-listing it.
//
// A category naming nothing is a typo, not an empty section, so it throws the
// same way an unknown dir does — otherwise the list just silently empties the
// next time a category is renamed.
const markerRe =
  /^<!--\s*doclist:([a-z0-9_-]+)((?:\s+(?:nodesc|grouped|category="[^"]+"))*)\s*-->$/

function listItem(entry: DocListEntry, showDescription: boolean): ListItem {
  const children: PhrasingContent[] = [
    {
      type: 'link',
      url: entry.url,
      children: [{ type: 'text', value: entry.title }],
    },
  ]
  if (showDescription && entry.description) {
    children.push({ type: 'text', value: ` — ${entry.description}` })
  }
  return {
    type: 'listItem',
    spread: false,
    children: [{ type: 'paragraph', children }],
  }
}

function list(entries: DocListEntry[], showDescription: boolean): List {
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: entries.map(entry => listItem(entry, showDescription)),
  }
}

function heading(text: string): Heading {
  return {
    type: 'heading',
    depth: 3,
    children: [{ type: 'text', value: text }],
  }
}

const remarkDocList: Plugin<[], Root> = () => tree => {
  // Collect edits first, then splice back-to-front so grouped markers (which
  // expand into multiple nodes) don't shift the indexes of later markers.
  const edits: { index: number; nodes: Root['children'] }[] = []
  tree.children.forEach((node, i) => {
    const match = node.type === 'html' ? markerRe.exec(node.value.trim()) : null
    if (match) {
      const dir = match[1]!
      const flags = match[2] ?? ''
      const showDescription = !flags.includes('nodesc')
      // A marker resolving to nothing is a typo'd dir (e.g. `doclist:tutorial`),
      // not a real empty directory — fail the build rather than silently
      // rendering an empty list.
      if (docsInDir(dir).length === 0) {
        throw new Error(`<!-- doclist:${dir} --> matched no docs`)
      }
      const category = /category="([^"]+)"/.exec(flags)?.[1]
      let nodes: Root['children']
      if (category) {
        const entries = docsInCategory(dir, category)
        if (entries.length === 0) {
          throw new Error(
            `<!-- doclist:${dir} category="${category}" --> matched no docs`,
          )
        }
        nodes = [list(entries, showDescription)]
      } else if (flags.includes('grouped')) {
        nodes = docsInDirGrouped(dir).flatMap(g => [
          heading(g.category),
          list(g.entries, showDescription),
        ])
      } else {
        nodes = [list(docsInDir(dir), showDescription)]
      }
      edits.push({ index: i, nodes })
    }
  })
  for (const edit of edits.reverse()) {
    tree.children.splice(edit.index, 1, ...edit.nodes)
  }
}

export default remarkDocList
