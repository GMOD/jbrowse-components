import { normalizeDocUrl } from './doc-slug.ts'
import { guideDirLabel } from './guide-title-collisions.ts'

import type { Heading, ListItem, Root } from 'mdast'
import type { Plugin } from 'unified'

const REFERENCE_DIRS = new Set(['config', 'models', 'api'])

// Display order of the groups; a bullet linking none of these keeps its
// author's text and sorts last.
export const KINDS = [
  'Tutorial',
  'User guide',
  'Config guide',
  'Developer guide',
  'Reference',
  'Docs',
]

export function kindOf(url: string): string | undefined {
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

export function kindRank(kind: string | undefined) {
  return kind ? KINDS.indexOf(kind) : KINDS.length
}

// The link text without what the kind prefix already says: a collision label
// ("Config guide: MAF track") or a typed trailing "tutorial".
function bareText(text: string, kind: string) {
  const unlabelled = text.startsWith(`${kind}: `)
    ? text.slice(kind.length + 2)
    : text
  return kind === 'Tutorial' ? unlabelled.replace(/\s+tutorial$/i, '') : unlabelled
}

function firstLink(item: ListItem) {
  const paragraph = item.children[0]
  if (paragraph?.type !== 'paragraph') {
    return undefined
  }
  const link = paragraph.children.find(c => c.type === 'link')
  return link?.type === 'link' ? { paragraph, link } : undefined
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
  const entries = list.children.map((item, order) => {
    const found = firstLink(item)
    const kind = found ? kindOf(found.link.url) : undefined
    if (found && kind) {
      const first = found.link.children[0]
      if (first?.type === 'text') {
        first.value = bareText(first.value, kind)
      }
      found.paragraph.children.unshift(
        { type: 'strong', children: [{ type: 'text', value: `${kind}:` }] },
        { type: 'text', value: ' ' },
      )
    }
    return { item, order, rank: kindRank(kind) }
  })
  entries.sort((a, b) => a.rank - b.rank || a.order - b.order)
  list.children = entries.map(e => e.item)
}

const remarkSeeAlso: Plugin<[], Root> = () => groupSeeAlso

export default remarkSeeAlso

// The same two steps over a page's Markdown source, for the raw copies that
// skip the remark pipeline: an empty-text `[](url)` takes its page's title
// (`titleFor`, undefined for an unknown page), and the See also bullets group
// and prefix as above. A bullet runs from its "- " to the next one.
export function seeAlsoMarkdown(
  markdown: string,
  titleFor: (url: string) => string | undefined,
) {
  const titled = markdown.replaceAll(
    /\[\]\(([^)\s]+)\)/g,
    (whole, url: string) => {
      const title = titleFor(normalizeDocUrl(url))
      return title ? `[${title}](${url})` : whole
    },
  )
  const lines = titled.split('\n')
  const start = lines.indexOf('## See also')
  if (start === -1) {
    return titled
  }
  const after = lines.findIndex((l, i) => i > start && l.startsWith('## '))
  const end = after === -1 ? lines.length : after
  const body = lines.slice(start + 1, end).filter(l => l.trim() !== '')
  if (!body[0]?.startsWith('- ')) {
    return titled
  }
  const bullets: string[][] = []
  for (const line of body) {
    if (line.startsWith('- ')) {
      bullets.push([line])
    } else {
      bullets.at(-1)!.push(line)
    }
  }
  const entries = bullets.map((bullet, order) => {
    const m = /^- \[([^\]]*)\]\(([^)\s]+)\)/.exec(bullet[0]!)
    const kind = m ? kindOf(m[2]!) : undefined
    if (m && kind) {
      const rest = bullet[0]!.slice(m[0].length)
      bullet[0] = `- **${kind}:** [${bareText(m[1]!, kind)}](${m[2]})${rest}`
    }
    return { text: bullet.join('\n'), order, rank: kindRank(kind) }
  })
  entries.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return [
    ...lines.slice(0, start + 1),
    '',
    ...entries.map(e => e.text),
    ...(end < lines.length ? [''] : []),
    ...lines.slice(end),
  ].join('\n')
}
