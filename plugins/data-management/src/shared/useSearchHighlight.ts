import { useLayoutEffect } from 'react'

import { alpha, useTheme } from '@mui/material'

import type { RefObject } from 'react'

const styleElements = new Map<string, HTMLStyleElement>()

function setHighlightStyle(name: string, color: string) {
  if (typeof document === 'undefined') {
    return
  }
  let el = styleElements.get(name)
  if (!el) {
    el = document.createElement('style')
    document.head.append(el)
    styleElements.set(name, el)
  }
  el.textContent = `::highlight(${name}) { background-color: ${color}; }`
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
  const theme = useTheme()
  const color = alpha(theme.palette.textHighlight.main, 0.45)

  useLayoutEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof CSS === 'undefined' || !CSS.highlights) {
      return
    }
    setHighlightStyle(highlightName, color)
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
  }, [containerRef, query, highlightName, color])
}
