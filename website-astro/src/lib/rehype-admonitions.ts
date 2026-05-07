import type { Root, Element, RootContent } from 'hast'
import type { Plugin } from 'unified'
import { getText } from './hast-utils.ts'

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const rehypeAdmonitions: Plugin<[], Root> = () => {
  return tree => {
    const children = tree.children as Element[]
    let i = 0
    while (i < children.length) {
      const node = children[i]
      if (node.type === 'element' && node.tagName === 'p') {
        const text = getText(node as RootContent).trim()
        const openMatch = text.match(/^:{3,}(\w+)(?:\s+(.+))?$/)
        if (openMatch) {
          const type = openMatch[1].toLowerCase()
          const title = openMatch[2] ?? capitalize(type)

          let j = i + 1
          while (j < children.length) {
            const cn = children[j]
            if (cn.type === 'element' && cn.tagName === 'p') {
              if (/^:{3,}\s*$/.test(getText(cn as RootContent).trim())) {
                break
              }
            }
            j++
          }

          const inner = children.slice(i + 1, j)
          const wrapper: Element = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['admonition', `admonition-${type}`] },
            children: [
              {
                type: 'element',
                tagName: 'div',
                properties: { className: ['admonition-title'] },
                children: [{ type: 'text', value: title }],
              },
              ...inner,
            ],
          }

          children.splice(i, j - i + 1, wrapper)
        }
      }
      i++
    }
  }
}

export default rehypeAdmonitions
