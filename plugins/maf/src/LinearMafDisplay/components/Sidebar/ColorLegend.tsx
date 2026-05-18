import React from 'react'

import { observer } from 'mobx-react'

import Tree from './Tree.tsx'

import type { LinearMafDisplayModel } from '../../stateModel.ts'

const DEFAULT_BG = 'rgb(255,255,255,0.5)'

const ColorLegend = observer(function ({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const {
    labelWidth,
    canDisplayLabel,
    totalHeight,
    treeWidth,
    sidebarWidth,
    samples = [],
    rowHeight,
    svgFontSize,
  } = model
  const boxHeight = Math.min(20, rowHeight)

  return (
    <>
      <rect
        y={0}
        x={0}
        width={sidebarWidth}
        height={totalHeight}
        fill={DEFAULT_BG}
      />
      <g transform="translate(4,0)">
        <Tree model={model} />
      </g>
      <g transform={`translate(${treeWidth + 9},0)`}>
        {samples.map((sample, idx) => (
          <rect
            key={`${sample.id}-${idx}`}
            y={idx * rowHeight}
            x={0}
            width={labelWidth + 5}
            height={boxHeight}
            fill={sample.color ?? DEFAULT_BG}
          />
        ))}
        {canDisplayLabel
          ? samples.map((sample, idx) => (
              <text
                key={`${sample.id}-${idx}`}
                dominantBaseline="middle"
                fontSize={svgFontSize}
                x={2}
                y={idx * rowHeight + rowHeight / 2}
              >
                {sample.label}
              </text>
            ))
          : null}
      </g>
    </>
  )
})

export default ColorLegend
