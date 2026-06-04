import React, { useRef, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

interface BaseHit {
  name: string
  genotype: string
  featureId: string
}

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
 * Caller supplies `getHit` (hit-test the canvas), `getTooltip` (the subset
 * of hit data passed to setHoveredGenotype), and `enrich` (turn a hit into
 * the SimpleFeature passed to select/setContextMenuFeature). `onHoverChange`
 * is invoked when the hovered hit changes — used by the regular variant
 * display to drive its HoveredCellHighlight overlay.
 */
export function useVariantCanvasInteraction<H extends BaseHit>(opts: {
  model: InteractionModel
  getHit: (rect: DOMRect, clientX: number, clientY: number) => H | undefined
  getTooltip: (hit: H) => Tooltip
  enrich: (hit: H) => Feature | undefined
  onHoverChange?: (hit: H | undefined) => void
}) {
  const { model, getHit, getTooltip, enrich, onHoverChange } = opts
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const lastHoveredRef = useRef<string | undefined>(undefined)

  function applyHoverChange(hit: H | undefined) {
    model.setHoveredGenotype(hit ? getTooltip(hit) : undefined)
    onHoverChange?.(hit)
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = getHit(rect, e.clientX, e.clientY)
    const key = hit ? `${hit.name}:${hit.genotype}:${hit.featureId}` : undefined
    if (key !== lastHoveredRef.current) {
      lastHoveredRef.current = key
      applyHoverChange(hit)
    }
  }

  const onMouseLeave = () => {
    if (lastHoveredRef.current !== undefined) {
      lastHoveredRef.current = undefined
      applyHoverChange(undefined)
    }
  }

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = getHit(rect, e.clientX, e.clientY)
    const enriched = hit ? enrich(hit) : undefined
    if (enriched) {
      model.selectFeature(enriched)
    }
  }

  const onContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = getHit(rect, e.clientX, e.clientY)
    const enriched = hit ? enrich(hit) : undefined
    if (enriched) {
      e.preventDefault()
      // clear the hover tooltip so it doesn't stay stuck behind the menu
      lastHoveredRef.current = undefined
      applyHoverChange(undefined)
      model.setContextMenuFeature(enriched)
      setContextMenuCoord([e.clientX, e.clientY])
    }
  }

  const contextMenuNode = contextMenuCoord ? (
    <Menu
      open
      onMenuItemClick={callback => {
        callback()
        setContextMenuCoord(undefined)
      }}
      onClose={() => {
        setContextMenuCoord(undefined)
        model.setContextMenuFeature(undefined)
      }}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenuCoord[1], left: contextMenuCoord[0] }}
      menuItems={model.contextMenuItems()}
    />
  ) : null

  return {
    canvasHandlers: { onMouseMove, onMouseLeave, onClick, onContextMenu },
    contextMenuNode,
  }
}
