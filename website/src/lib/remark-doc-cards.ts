import { cardForUrl } from './autogen-links.ts'
import { guideThumbSpec } from './guide-thumbs.ts'
import { escapeAttr, escapeHtml } from './inline-html.ts'

import type { List, Root, RootContent } from 'mdast'
import type { Plugin } from 'unified'

// Replaces the list under a `<!-- doccards -->` marker, one `[](/docs/...)`
// link per item, with a grid of cards: thumbnail, title and description. The
// thumbnail is the one gen-tutorial-thumbs.ts writes for the page, so a page
// with no figure gets a card with no image.
const markerRe = /^<!--\s*doccards\s*-->$/

function linkUrls(list: List, file: string): string[] {
  return list.children.map(item => {
    const [para, ...restOfItem] = item.children
    const [link, ...restOfPara] =
      para?.type === 'paragraph' ? para.children : []
    if (link?.type !== 'link' || restOfItem.length || restOfPara.length) {
      throw new Error(`${file}: a doccards list item must be a lone link`)
    }
    return link.url
  })
}

function thumbFor(id: string, body: string): string | undefined {
  const [dir, slug] = id.split('/')
  if (dir === 'user_guides' && slug && guideThumbSpec(slug, body)) {
    return `/img/guide-thumbs/${slug}.webp`
  }
  return undefined
}

function cardHtml(url: string, file: string): string {
  const card = cardForUrl(url)
  if (!card) {
    throw new Error(`${file}: doccards link to unresolvable page: ${url}`)
  }
  const thumb = thumbFor(card.id, card.body)
  const img = thumb
    ? `<img class="doc-card-thumb" src="${escapeAttr(thumb)}" loading="lazy" decoding="async" alt="">`
    : '<span class="doc-card-thumb doc-card-thumb-empty">JBrowse 2</span>'
  const desc = card.description
    ? `<span class="doc-card-desc">${escapeHtml(card.description)}</span>`
    : ''
  return `<a class="doc-card" href="${escapeAttr(url)}">${img}<span class="doc-card-body"><span class="doc-card-title">${escapeHtml(card.title)}</span>${desc}</span></a>`
}

const remarkDocCards: Plugin<[], Root> = () => (tree, file) => {
  const name = String(file.data.id)
  const out: RootContent[] = []
  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]!
    if (node.type === 'html' && markerRe.test(node.value.trim())) {
      const list = tree.children[i + 1]
      if (list?.type !== 'list') {
        throw new Error(`${name}: <!-- doccards --> must sit above a list`)
      }
      const cards = linkUrls(list, name).map(url => cardHtml(url, name))
      out.push({
        type: 'html',
        value: `<div class="doc-cards">${cards.join('')}</div>`,
      })
      i++
    } else {
      out.push(node)
    }
  }
  tree.children = out
}

export default remarkDocCards
