import type { Root, Paragraph } from 'mdast'
import type { Plugin } from 'unified'
import { visit, SKIP } from 'unist-util-visit'

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /(\w+)=(?:"([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    attrs[m[1]] = m[2] ?? m[3]
  }
  return attrs
}

const remarkFigure: Plugin<[], Root> = () => {
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

    visit(tree, 'html', node => {
      const match = node.value.match(/<Figure\s+([\s\S]*?)\s*\/>/)
      if (!match) {
        return
      }
      const attrs = parseAttrs(match[1])
      const src = attrs.src ?? ''
      const caption = attrs.caption ?? ''
      node.value = `<figure><img src="${src}" alt="${caption}"/><figcaption>${caption}</figcaption></figure>`
    })
  }
}

export default remarkFigure
