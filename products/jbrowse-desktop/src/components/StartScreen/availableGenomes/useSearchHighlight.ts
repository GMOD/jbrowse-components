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

// Pure DOM scan: every non-overlapping, case-insensitive match of queryLower
// within root becomes a Range. queryLower is assumed already lowercased and
// non-empty (an empty needle would match at every offset and never advance).
function collectMatchRanges(root: Element, queryLower: string): Range[] {
  const ranges: Range[] = []
  for (const textNode of getTextNodes(root)) {
    const textLower = textNode.textContent.toLowerCase()
    let idx = textLower.indexOf(queryLower)
    while (idx !== -1) {
      const range = new Range()
      range.setStart(textNode, idx)
      range.setEnd(textNode, idx + queryLower.length)
      ranges.push(range)
      idx = textLower.indexOf(queryLower, idx + queryLower.length)
    }
  }
  return ranges
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
    if (typeof CSS !== 'undefined') {
      setHighlightStyle(alpha(theme.palette.textHighlight.main, 0.45))
      const container = containerRef.current
      const queryLower = query.trim().toLowerCase()
      if (container && queryLower) {
        const highlight = new Highlight()
        for (const range of collectMatchRanges(container, queryLower)) {
          highlight.add(range)
        }
        CSS.highlights.set(HIGHLIGHT_NAME, highlight)
      } else {
        CSS.highlights.delete(HIGHLIGHT_NAME)
      }
      return () => {
        CSS.highlights.delete(HIGHLIGHT_NAME)
      }
    }
    return undefined
  })
}
