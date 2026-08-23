import { useRef, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'

import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { MouseEvent } from 'react'

// Matches the real display model's setHoveredGenotype param — a tooltip record
// that always carries genotype + name (the rest is display-specific fields).
type Tooltip = Record<string, unknown> & { genotype: string; name: string }

interface InteractionModel {
  setHoveredGenotype: (g: Tooltip | undefined) => void
  selectFeature: (f: Feature) => void
  setContextMenuFeature: (f?: Feature) => void
  contextMenuItems: () => MenuItem[]
}

/**
 * Shared mouse-interaction scaffolding for the variant canvas displays.
 * Wires onMouseMove (with key-dedup hover), onMouseLeave, onClick
 * (enriched-feature select), and onContextMenu (enriched-feature + Menu),
 * and renders the popup Menu itself.
 *
 * The handlers are typed to `HTMLElement`, not to the canvas: the genotype rows
 * put them on their canvas because it is the element with the pointer over it,
 * while the variant lane's canvas is an `OverlayCanvas` (`pointerEvents: none`
 * by construction, so a paint layer never eats a gesture) and puts them on a
 * transparent div over it instead.
 *
 * The hit is opaque to the hook: the caller supplies `getHit` (hit-test the
 * canvas), `getKey` (hover-dedup identity), `getTooltip` (the subset of hit data
 * passed to setHoveredGenotype), and `enrich` (turn a hit into the SimpleFeature
 * passed to select/setContextMenuFeature). `onHoverChange` is invoked when the
 * hovered hit changes — used by the regular variant display to drive its
 * HoveredCellHighlight overlay.
 */
export function useVariantCanvasInteraction<H>(opts: {
  model: InteractionModel
  getHit: (rect: DOMRect, clientX: number, clientY: number) => H | undefined
  getKey: (hit: H) => string
  getTooltip: (hit: H) => Tooltip
  enrich: (hit: H) => Feature | undefined
  onHoverChange?: (hit: H | undefined) => void
}) {
  const { model, getHit, getKey, getTooltip, enrich, onHoverChange } = opts
  const [contextMenuAnchor, setContextMenuAnchor] = useState<
    ContextMenuAnchor | undefined
  >()
  const lastHoveredRef = useRef<string | undefined>(undefined)

  function applyHoverChange(hit: H | undefined) {
    model.setHoveredGenotype(hit ? getTooltip(hit) : undefined)
    onHoverChange?.(hit)
  }

  function clearHover() {
    lastHoveredRef.current = undefined
    applyHoverChange(undefined)
  }

  function resolveFeature(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = getHit(rect, e.clientX, e.clientY)
    return hit ? enrich(hit) : undefined
  }

  const onMouseMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = getHit(rect, e.clientX, e.clientY)
    const key = hit ? getKey(hit) : undefined
    if (key !== lastHoveredRef.current) {
      lastHoveredRef.current = key
      applyHoverChange(hit)
    }
  }

  const onMouseLeave = () => {
    if (lastHoveredRef.current !== undefined) {
      clearHover()
    }
  }

  const onClick = (e: MouseEvent<HTMLElement>) => {
    const enriched = resolveFeature(e)
    if (enriched) {
      // clear the hover tooltip so it doesn't linger after the widget opens
      clearHover()
      model.selectFeature(enriched)
    }
  }

  const onContextMenu = (e: MouseEvent<HTMLElement>) => {
    const enriched = resolveFeature(e)
    if (enriched) {
      e.preventDefault()
      // clear the hover tooltip so it doesn't stay stuck behind the menu
      clearHover()
      model.setContextMenuFeature(enriched)
      setContextMenuAnchor({ clientX: e.clientX, clientY: e.clientY })
    }
  }

  const contextMenuNode = (
    <ContextMenu
      anchor={contextMenuAnchor}
      menuItems={() => model.contextMenuItems()}
      onClose={() => {
        setContextMenuAnchor(undefined)
        model.setContextMenuFeature(undefined)
      }}
    />
  )

  return {
    canvasHandlers: { onMouseMove, onMouseLeave, onClick, onContextMenu },
    contextMenuNode,
  }
}
