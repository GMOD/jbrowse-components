import type { RootContent } from 'hast'

export function getText(node: RootContent): string {
  if (node.type === 'text') {
    return node.value
  }
  if ('children' in node) {
    return node.children.map(c => getText(c as RootContent)).join('')
  }
  return ''
}
