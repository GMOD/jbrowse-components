import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

const rehypeHeadingLinks: Plugin<[], Root> = () => {
  return tree => {
    const children = tree.children
    for (let i = 0; i < children.length; i++) {
      const node = children[i] as Element
      if (
        node.type !== 'element' ||
        !['h2', 'h3', 'h4'].includes(node.tagName)
      ) {
        continue
      }
      const id = node.properties?.id as string | undefined
      if (!id) {
        continue
      }
      const anchor: Element = {
        type: 'element',
        tagName: 'a',
        properties: {
          href: `#${id}`,
          className: ['heading-anchor'],
          ariaHidden: 'true',
          tabIndex: -1,
        },
        children: [{ type: 'text', value: '#' }],
      }
      children[i] = { ...node, children: [...node.children, anchor] }
    }
  }
}

export default rehypeHeadingLinks
