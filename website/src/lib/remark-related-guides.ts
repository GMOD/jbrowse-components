import { backlinksFor } from './autogen-links.ts'

import type { Heading, Link, List, ListItem, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

interface GuideRef {
  title: string
  url: string
  kind: string
}

function headingText(heading: Heading): string {
  return heading.children.map(c => (c.type === 'text' ? c.value : '')).join('')
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

// One bullet per guide, prefixed with its kind — "Guide:" matches the
// "**Kind:** link" convention the generator uses for its own entries
// (Track/Adapter/Display/...) in the same list, so the merged list reads as
// one consistent style. A guide whose title collides with another guide's
// (config_guides/hic_track.md and user_guides/hic_track.md are both titled
// "Hi-C track") gets its directory as the kind instead, so the two bullets
// read as distinct rather than as the same link twice.
function guideListItem(ref: GuideRef): ListItem {
  return {
    type: 'listItem',
    spread: false,
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'strong',
            children: [{ type: 'text', value: `${ref.kind}:` }],
          },
          { type: 'text', value: ' ' },
          linkNode(ref),
        ],
      },
    ],
  }
}

// Append the guides that reference this page. This runs on reference pages
// (config/models/api) only: the backlink direction is the one the autogen
// lacks and nobody can hand-maintain, since a generated page is wiped on every
// `pnpm autogen`.
//
// It used to also give hand-written guides a "Related guides" footer of
// siblings citing the same reference pages. That fired on 21 of 121 guides
// (it needs two shared citations) while all 108 guides with cross-links
// already carry a curated "## See also" — so on 20 pages it rendered a second
// link list right below the first, 12 of the links identical. The curated list
// is the better one and is the convention everywhere; this now stays out of
// its way.
//
// A config page's own "## Related links" section (adapter/track/display
// cross-refs, written directly into the generated markdown — see
// generateConfigDocs.ts) and this guide-backlink footer used to render as two
// separate headings on the same page. Merge them: on a page that already has
// "## Related links", append one "**Guide:** ..." bullet per guide to that
// list instead of a second heading. On models/api pages, which have no
// cross-refs of their own, write the heading + list from scratch.
const AUTOGEN_DIRS = new Set(['config', 'models', 'api'])

const remarkRelatedGuides: Plugin<[], Root> = () => {
  return (tree, file) => {
    const id = typeof file.data.id === 'string' ? file.data.id : ''
    if (!AUTOGEN_DIRS.has(id.split('/')[0]!)) {
      return
    }
    const links = backlinksFor(id)
    if (links.length === 0) {
      return
    }
    const existingList = findRelatedLinksList(tree)
    if (existingList) {
      existingList.children.push(...links.map(guideListItem))
      return
    }
    const heading: Heading = {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: 'Related links' }],
    }
    const list: List = {
      type: 'list',
      ordered: false,
      spread: false,
      children: links.map(guideListItem),
    }
    tree.children.push(heading, list)
  }
}

export default remarkRelatedGuides
