import { backlinksFor, relatedGuidesFor } from './autogen-links.ts'

import type { Heading, Link, List, ListItem, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

interface GuideRef {
  title: string
  url: string
}

function headingText(heading: Heading): string {
  return heading.children
    .map(c => (c.type === 'text' ? c.value : ''))
    .join('')
}

// The generator-written "## Related links" list on config pages (see
// generateConfigDocs.ts), if this page has one — so guide backlinks land as
// more bullets in that same list rather than a second heading.
function findRelatedLinksList(tree: Root): List | undefined {
  const idx = tree.children.findIndex(
    (node): node is Heading =>
      node.type === 'heading' &&
      node.depth === 2 &&
      headingText(node) === 'Related links',
  )
  const next: RootContent | undefined =
    idx === -1 ? undefined : tree.children[idx + 1]
  return next?.type === 'list' ? next : undefined
}

function linkNode({ title, url }: GuideRef): Link {
  return { type: 'link', url, children: [{ type: 'text', value: title }] }
}

// One bullet per guide, prefixed "Guide:" — matches the "**Kind:** link"
// convention the generator uses for its own entries (Track/Adapter/Display/
// ...) in the same list, so the merged list reads as one consistent style.
function guideListItem(ref: GuideRef): ListItem {
  return {
    type: 'listItem',
    spread: false,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'strong', children: [{ type: 'text', value: 'Guide:' }] },
          { type: 'text', value: ' ' },
          linkNode(ref),
        ],
      },
    ],
  }
}

function plainListItem(ref: GuideRef): ListItem {
  return {
    type: 'listItem',
    spread: false,
    children: [{ type: 'paragraph', children: [linkNode(ref)] }],
  }
}

// Append the guides that reference this page. Reference pages
// (config/models/api) list the guides that link to them — the backlink
// direction the autogen otherwise lacks. Guides list sibling guides that cite
// the same reference pages.
//
// A config page's own "## Related links" section (adapter/track/display
// cross-refs, written directly into the generated markdown — see
// generateConfigDocs.ts) and this guide-backlink footer used to render as two
// separate "Related links" / "Related guides" headings on the same page.
// Merge them: on an autogen page that already has "## Related links", append
// one "**Guide:** ..." bullet per guide to that list instead of a second
// heading. Elsewhere (models/api pages with no cross-refs, or hand-written
// guide pages), fall back to writing the heading + list from scratch.
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
    const existingList = isAutogen ? findRelatedLinksList(tree) : undefined
    if (existingList) {
      existingList.children.push(...links.map(guideListItem))
      return
    }
    const heading: Heading = {
      type: 'heading',
      depth: 2,
      children: [
        { type: 'text', value: isAutogen ? 'Related links' : 'Related guides' },
      ],
    }
    const list: List = {
      type: 'list',
      ordered: false,
      spread: false,
      children: links.map(isAutogen ? guideListItem : plainListItem),
    }
    tree.children.push(heading, list)
  }
}

export default remarkRelatedGuides
