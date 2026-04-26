import { type RefObject, useLayoutEffect } from 'react'

const registeredHighlights = new Set<string>()

function ensureHighlightStyle(name: string) {
  if (registeredHighlights.has(name) || typeof document === 'undefined') {
    return
  }
  registeredHighlights.add(name)
  const style = document.createElement('style')
  style.textContent = `::highlight(${name}) { background-color: yellow; color: black; }`
  document.head.append(style)
}

function getTextNodes(root: Element): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  return nodes
}

export function useSearchHighlight(
  containerRef: RefObject<HTMLElement | null>,
  query: string,
  highlightName: string,
) {
  useLayoutEffect(() => {
    if (typeof CSS === 'undefined') {
      return
    }
    ensureHighlightStyle(highlightName)
    const container = containerRef.current
    if (container && query.trim()) {
      const queryLower = query.toLowerCase().trim()
      const highlight = new Highlight()
      for (const textNode of getTextNodes(container)) {
        const text = textNode.textContent
        const textLower = text.toLowerCase()
        let offset = 0
        while (offset < textLower.length) {
          const idx = textLower.indexOf(queryLower, offset)
          if (idx === -1) {
            break
          }
          const range = new Range()
          range.setStart(textNode, idx)
          range.setEnd(textNode, idx + queryLower.length)
          highlight.add(range)
          offset = idx + queryLower.length
        }
      }
      CSS.highlights.set(highlightName, highlight)
    } else {
      CSS.highlights.delete(highlightName)
    }
    return () => {
      CSS.highlights.delete(highlightName)
    }
  })
}
