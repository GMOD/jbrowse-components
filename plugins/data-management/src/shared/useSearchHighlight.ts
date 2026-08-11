import { useLayoutEffect } from 'react'

import { alpha, useTheme } from '@mui/material'

import { normalizeSearchQuery } from './searchText.ts'

import type { RefObject } from 'react'

// one <style> per highlight name, so two tables highlighting at once don't
// overwrite each other's color rule
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
  highlightName: string,
) {
  const theme = useTheme()
  const color = alpha(theme.palette.textHighlight.main, 0.45)

  // No deps: must re-run after every render, because a Range detaches when its
  // text node is removed — scrolling a virtualized table swaps the rendered
  // rows, so the highlights have to be recollected against the new DOM
  useLayoutEffect(() => {
    // absent in jest, and in browsers without the CSS custom highlight API
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof CSS === 'undefined' || !CSS.highlights) {
      return undefined
    }
    setHighlightStyle(highlightName, color)
    const container = containerRef.current
    // the same normalization the filter itself applies, so what is highlighted
    // is what matched
    const queryLower = normalizeSearchQuery(query)
    if (container && queryLower) {
      const highlight = new Highlight()
      for (const range of collectMatchRanges(container, queryLower)) {
        highlight.add(range)
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
