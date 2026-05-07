import type { Root, Paragraph, Image } from 'mdast'
import type { Plugin } from 'unified'
import { visit, SKIP } from 'unist-util-visit'

const attrRe = /(\w+)=(?:"([^"]*)"|'([^']*)')/g
const figureRe = /<Figure\s+([\s\S]*?)\s*\/>/

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  attrRe.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(str)) !== null) {
    attrs[m[1]] = m[2] ?? m[3]
  }
  return attrs
}

const remarkFigure: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  return tree => {
    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      if (
        node.children.length === 1 &&
        node.children[0].type === 'text' &&
        node.children[0].value.startsWith('import Figure from ')
      ) {
        parent!.children.splice(index!, 1)
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
      const attrs = parseAttrs(match[1])
      const rawSrc = attrs.src ?? ''
      const src = base && rawSrc.startsWith('/') ? `${base}${rawSrc}` : rawSrc
      const caption = attrs.caption ?? ''
      node.value = `<figure><img src="${src}" alt="${caption}"/><figcaption>${caption}</figcaption></figure>`
    })
  }
}

export default remarkFigure
