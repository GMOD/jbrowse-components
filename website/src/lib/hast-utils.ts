import type { Element, RootContent } from 'hast'

export function getText(node: RootContent): string {
  if (node.type === 'text') {
    return node.value
  }
  if ('children' in node) {
    return node.children.map(c => getText(c as RootContent)).join('')
  }
  return ''
}

// The heading mdast-util-gfm-footnote writes above the notes. The page did not
// write it and it is not one of its sections, so it gets no table-of-contents
// entry and no heading anchor.
export function isFootnoteLabel(node: Element) {
  return node.properties.id === 'footnote-label'
}
