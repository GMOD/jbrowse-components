import { observer } from 'mobx-react'

import { hoverHighlightRect } from './hoverHighlightRect.ts'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'

/**
 * Box over the block under the mouse. The painting's colors are the data, so
 * the mark is a white wash plus a dark border rather than a color tint — the
 * same treatment the multi-sample variant matrix gives its hovered cell.
 *
 * Its own observer so a mouse move repaints only this layer, not the canvas
 * subtree around it.
 */
const MultiRowHoverHighlight = observer(function MultiRowHoverHighlight({
  model,
}: {
  model: LinearMultiRowFeatureDisplayModel
}) {
  const {
    hoveredFeature,
    contextMenuInfo,
    renderBlocks,
    rowHeight,
    rowProportion,
  } = model
  // openContextMenu clears the hover (else the tooltip sticks under the menu),
  // but the block the menu acts on is exactly what should stay marked while it's
  // open, and contextMenuInfo carries it
  const hit = hoveredFeature ?? contextMenuInfo?.hit
  const rect = hit
    ? hoverHighlightRect({
        hit,
        blocks: renderBlocks,
        rowHeight,
        rowProportion,
      })
    : undefined
  return rect ? (
    <div
      data-testid="multirow_hover_highlight"
      style={{
        position: 'absolute',
        ...rect,
        border: '1px solid rgba(0,0,0,0.5)',
        background: 'rgba(255,255,255,0.3)',
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default MultiRowHoverHighlight
