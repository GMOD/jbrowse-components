import { useLayoutEffect } from 'react'

import { usePalette } from './PaletteContext.tsx'
import { alpha } from './palette.ts'

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

// Pure DOM scan: every match of each pattern within root becomes a Range.
// Patterns are global and never match the empty string.
function collectMatchRanges(root: Element, patterns: RegExp[]): Range[] {
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
 * through the CSS custom highlight API, so no text node is split
 */
export function useSearchHighlight(
  containerRef: RefObject<HTMLElement | null>,
  patterns: RegExp[],
  highlightName: string,
) {
  const palette = usePalette()
  const color = alpha(palette.textHighlight.main, 0.45)

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
  })
}
