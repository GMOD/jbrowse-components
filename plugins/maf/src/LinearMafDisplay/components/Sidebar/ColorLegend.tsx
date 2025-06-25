import React from 'react'

import { observer } from 'mobx-react'

import RectBg from './RectBg'
import Tree from './Tree'

import type { LinearMafDisplayModel } from '../../stateModel'

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
    samples = [],
    rowHeight,
    svgFontSize,
  } = model
  const boxHeight = Math.min(20, rowHeight)

  return (
    <>
      <RectBg
        y={0}
        x={0}
        width={labelWidth + 5 + treeWidth}
        height={totalHeight}
      />
      <Tree model={model} />
      <g transform={`translate(${treeWidth + 5},0)`}>
        {samples.map((sample, idx) => (
          <RectBg
            key={`${sample.id}-${idx}`}
            y={idx * rowHeight}
            x={0}
            width={labelWidth + 5}
            height={boxHeight}
            color={sample.color}
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
