import React from 'react'

import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../../stateModel.ts'

const FILL = 'rgba(255,165,0,0.2)'
const DOT_FILL = 'rgba(255,165,0,0.8)'
const DOT_STROKE = 'rgba(255,140,0,1)'

/**
 * Declarative hover overlay drawn into the existing SvgWrapper <svg>:
 * - One translucent rectangle per highlighted leaf (row hover from tree).
 * - A small circle at the hovered tree node, paired with the rows.
 *
 * Rendered as SVG so MobX reactivity drives React updates instead of an
 * imperative canvas autorun. Either piece collapses to null when its inputs
 * are absent.
 */
const RowHighlights = observer(function RowHighlights({
  model,
  width,
}: {
  model: LinearMafDisplayModel
  width: number
}) {
  const { highlightedRowNames, hoveredTreeNode, leafMap, rowHeight } = model
  if (!highlightedRowNames) {
    return null
  }
  const halfRowHeight = rowHeight / 2
  return (
    <g>
      {highlightedRowNames.map(name => {
        const leaf = leafMap.get(name)
        return leaf?.x !== undefined ? (
          <rect
            key={name}
            x={0}
            y={leaf.x - halfRowHeight}
            width={width}
            height={rowHeight}
            fill={FILL}
          />
        ) : null
      })}
      {hoveredTreeNode ? (
        <circle
          cx={hoveredTreeNode.y}
          cy={hoveredTreeNode.x}
          r={4}
          fill={DOT_FILL}
          stroke={DOT_STROKE}
          strokeWidth={1}
        />
      ) : null}
    </g>
  )
})

export default RowHighlights
