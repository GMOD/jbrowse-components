import { type RefObject, useLayoutEffect } from 'react'

import { alpha, useTheme } from '@mui/material'

const HIGHLIGHT_NAME = 'jbrowse-search'

let styleEl: HTMLStyleElement | null = null

function setHighlightStyle(color: string) {
  if (typeof document === 'undefined') {
    return
  }
  if (!styleEl) {
    styleEl = document.createElement('style')
    document.head.append(styleEl)
  }
  styleEl.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: ${color}; }`
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
) {
  const theme = useTheme()

  // No deps: must re-run after every render so paginating to a new page
  // re-applies highlights to the new DOM content (Range objects detach on removal).
  useLayoutEffect(() => {
    // generally just jest test but maybe unsupported browser
    if (typeof CSS === 'undefined') {
      return
    }
    setHighlightStyle(alpha(theme.palette.textHighlight.main, 0.45))
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
      CSS.highlights.set(HIGHLIGHT_NAME, highlight)
    } else {
      CSS.highlights.delete(HIGHLIGHT_NAME)
    }
    return () => {
      CSS.highlights.delete(HIGHLIGHT_NAME)
    }
  })
}
