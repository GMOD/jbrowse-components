import { SKIP, visit } from 'unist-util-visit'

import { screenshotLiveUrls } from '../../scripts/screenshot-specs.ts'

import type { Image, Paragraph, Root } from 'mdast'
import type { Plugin } from 'unified'

const attrRe = /(\w+)=(?:"([^"]*)"|'([^']*)')/g
const figureRe = /<Figure\s+([\s\S]*?)\s*\/>/

// map each /img/<name>.png to the live JBrowse instance that produced it, so a
// screenshot links to a running view the reader can open and explore
const liveUrlByImg = new Map(
  Object.entries(screenshotLiveUrls).map(([name, url]) => [
    `/img/${name}.png`,
    url,
  ]),
)

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  attrRe.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(str)) !== null) {
    attrs[m[1]!] = m[2] ?? m[3] ?? ''
  }
  return attrs
}

const remarkFigure: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  return tree => {
    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      const firstChild = node.children[0]
      if (
        node.children.length === 1 &&
        firstChild?.type === 'text' &&
        firstChild.value.startsWith('import ')
      ) {
        if (index === undefined || !parent) {
          return
        }
        parent.children.splice(index, 1)
        return [SKIP, index]
      }
    })

    if (base) {
      visit(tree, 'image', (node: Image) => {
        if (node.url.startsWith('/')) {
          node.url = `${base}${node.url}`
        }
      })
    }

    visit(tree, 'html', node => {
      const match = figureRe.exec(node.value)
      if (!match) {
        return
      }
      const attrs = parseAttrs(match[1]!)
      const rawSrc = attrs.src ?? ''
      const src = base && rawSrc.startsWith('/') ? `${base}${rawSrc}` : rawSrc
      const caption = attrs.caption ?? ''
      // explicit link= wins; otherwise auto-link screenshots that came from a
      // screenshot-spec session
      const liveUrl = attrs.link ?? liveUrlByImg.get(rawSrc)
      const altText = caption.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      const img = `<img src="${src}" alt="${altText}"/>`
      if (liveUrl) {
        const a = (inner: string) =>
          `<a href="${liveUrl}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        node.value = `<figure>${a(img)}<figcaption>${caption} ${a('Open this view in JBrowse ↗')}</figcaption></figure>`
      } else {
        node.value = `<figure>${img}<figcaption>${caption}</figcaption></figure>`
      }
    })
  }
}

export default remarkFigure
