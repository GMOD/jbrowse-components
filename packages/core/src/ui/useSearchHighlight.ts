import { useLayoutEffect } from 'react'

import { usePalette } from './PaletteContext.tsx'
import { alpha } from './palette.ts'

import type { RefObject } from 'react'

function hasHighlightApi() {
  // absent in jest, and in browsers without the CSS custom highlight API
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return typeof CSS !== 'undefined' && !!CSS.highlights
}

function getTextNodes(root: Element) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node instanceof Text) {
      nodes.push(node)
    }
    node = walker.nextNode()
  }
  return nodes
}

// Patterns are global and never match the empty string.
function collectMatchRanges(root: Element, patterns: RegExp[]) {
  const ranges: Range[] = []
  for (const textNode of getTextNodes(root)) {
    for (const pattern of patterns) {
      for (const match of textNode.textContent.matchAll(pattern)) {
        const range = new Range()
        range.setStart(textNode, match.index)
        range.setEnd(textNode, match.index + match[0].length)
        ranges.push(range)
      }
    }
  }
  return ranges
}

/**
 * Highlights every match of `patterns` in the text under `containerRef`,
 * through the CSS custom highlight API, so no text node is split. The color
 * rule lives in a `<style>` this hook owns while there is something to mark.
 */
export function useSearchHighlight(
  containerRef: RefObject<HTMLElement | null>,
  patterns: RegExp[],
  highlightName: string,
) {
  const palette = usePalette()
  const color = alpha(palette.textHighlight.main, 0.45)
  const marking = patterns.length > 0

  useLayoutEffect(() => {
    if (marking && hasHighlightApi()) {
      const el = document.createElement('style')
      el.textContent = `::highlight(${highlightName}) { background-color: ${color}; }`
      document.head.append(el)
      return () => {
        el.remove()
      }
    }
    return undefined
  }, [highlightName, color, marking])

  // No deps: must re-run after every render, because a Range detaches when its
  // text node is removed — scrolling a virtualized table swaps the rendered
  // rows, so the highlights have to be recollected against the new DOM
  useLayoutEffect(() => {
    if (hasHighlightApi()) {
      const container = containerRef.current
      if (container && patterns.length) {
        const highlight = new Highlight()
        for (const range of collectMatchRanges(container, patterns)) {
          highlight.add(range)
        }
        CSS.highlights.set(highlightName, highlight)
      } else {
        CSS.highlights.delete(highlightName)
      }
      return () => {
        CSS.highlights.delete(highlightName)
      }
    }
    return undefined
  })
}
