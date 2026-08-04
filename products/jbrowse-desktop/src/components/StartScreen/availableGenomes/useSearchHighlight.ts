import { useLayoutEffect } from 'react'

import { alpha, useTheme } from '@mui/material'

import { searchTokens } from './searchTokens.ts'

import type { RefObject } from 'react'

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

// Pure DOM scan: every case-insensitive match of any token within root becomes
// a Range. Tokens come from searchTokens, so they are already lowercased and
// non-empty (an empty needle would match at every offset and never advance).
//
// Per token, not per query, because that is what the search itself matches: a
// row is a hit when every token appears somewhere in it, in any field, so
// "e coli" finds Escherichia coli — a string the whole query is not a substring
// of. Highlighting the raw query left every multi-word search with no highlight
// at all. Ranges from different tokens may overlap; the CSS Highlight API
// unions them.
export function collectMatchRanges(root: Element, tokens: string[]): Range[] {
  const ranges: Range[] = []
  for (const textNode of getTextNodes(root)) {
    const textLower = textNode.textContent.toLowerCase()
    for (const token of tokens) {
      let idx = textLower.indexOf(token)
      while (idx !== -1) {
        const range = new Range()
        range.setStart(textNode, idx)
        range.setEnd(textNode, idx + token.length)
        ranges.push(range)
        idx = textLower.indexOf(token, idx + token.length)
      }
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
      const tokens = searchTokens(query)
      if (container && tokens.length) {
        const highlight = new Highlight()
        for (const range of collectMatchRanges(container, tokens)) {
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
