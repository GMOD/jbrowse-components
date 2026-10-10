import { guideDirLabel } from './guide-title-collisions.ts'

import type { Heading, ListItem, PhrasingContent, Root } from 'mdast'
import type { Plugin } from 'unified'

const REFERENCE_DIRS = new Set(['config', 'models', 'api'])

// Display order of the groups; a bullet linking none of these keeps its
// author's text and sorts last.
const KINDS = [
  'Tutorial',
  'User guide',
  'Config guide',
  'Developer guide',
  'Reference',
  'Docs',
]

function kindOf(url: string): string | undefined {
  const m = /(?:^|\/)docs\/([^/#?]+)/.exec(url)
  if (!m) {
    return undefined
  }
  const dir = m[1]!
  if (REFERENCE_DIRS.has(dir)) {
    return 'Reference'
  }
  const label = guideDirLabel(dir)
  return label === dir ? 'Docs' : label
}

function firstLink(item: ListItem) {
  const paragraph = item.children[0]
  if (paragraph?.type !== 'paragraph') {
    return undefined
  }
  const link = paragraph.children.find(c => c.type === 'link')
  return link?.type === 'link' ? { paragraph, link } : undefined
}

function stripKindPrefix(children: PhrasingContent[], kind: string) {
  const first = children[0]
  if (first?.type === 'text' && first.value.startsWith(`${kind}: `)) {
    first.value = first.value.slice(kind.length + 2)
  }
}

// Gives each "## See also" bullet a bold kind lead-in ("**Tutorial:** ...")
// and gathers bullets of one kind together, in the order KINDS lists them and
// the author's order within a kind. Authors write a bare link per bullet; the
// kind comes from the link's directory, so it cannot drift from the target.
export function groupSeeAlso(tree: Root) {
  const idx = tree.children.findIndex(
    (node): node is Heading =>
      node.type === 'heading' &&
      node.depth === 2 &&
      node.children.map(c => (c.type === 'text' ? c.value : '')).join('') ===
        'See also',
  )
  const list = idx === -1 ? undefined : tree.children[idx + 1]
  if (list?.type !== 'list') {
    return
  }
  const rank = (kind: string | undefined) =>
    kind ? KINDS.indexOf(kind) : KINDS.length
  const entries = list.children.map((item, order) => {
    const found = firstLink(item)
    const kind = found ? kindOf(found.link.url) : undefined
    if (found && kind) {
      stripKindPrefix(found.link.children, kind)
      found.paragraph.children.unshift(
        { type: 'strong', children: [{ type: 'text', value: `${kind}:` }] },
        { type: 'text', value: ' ' },
      )
    }
    return { item, order, rank: rank(kind) }
  })
  entries.sort((a, b) => a.rank - b.rank || a.order - b.order)
  list.children = entries.map(e => e.item)
}

const remarkSeeAlso: Plugin<[], Root> = () => groupSeeAlso

export default remarkSeeAlso
