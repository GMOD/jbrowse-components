import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { contrastingTextColor } from '@jbrowse/core/util/color'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export default function ScoreText({
  feature,
  config,
  layoutRecord: {
    y,
    data: { anchorX, radiusPx, score },
  },
}: {
  feature: Feature
  config: AnyConfigurationModel
  layoutRecord: {
    y: number
    data: { anchorX: number; radiusPx: number; score: number }
  }
}) {
  const innerColor = readConfObject(config, 'innerColor', { feature })

  const scoreString = String(score)
  const fontWidth = (radiusPx * 2) / scoreString.length
  const fontHeight = fontWidth * 1.1
  if (fontHeight < 12) {
    return null
  }
  return (
    <text
      style={{ fontSize: fontHeight, fill: contrastingTextColor(innerColor) }}
      x={anchorX}
      y={y + radiusPx - fontHeight / 2.4}
      textAnchor="middle"
      dominantBaseline="hanging"
    >
      {scoreString}
    </text>
  )
}
