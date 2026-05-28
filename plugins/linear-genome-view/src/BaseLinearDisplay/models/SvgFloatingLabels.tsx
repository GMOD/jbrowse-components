import { Fragment } from 'react'

import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import {
  type FeatureLabelData,
  calculateFloatingLabelPosition,
} from '../components/util.ts'

const FONT_SIZE = 11

interface Props {
  featureLabels: Map<string, FeatureLabelData>
  offsetPx: number
  viewWidth: number
}

function FloatingLabel({
  x,
  y,
  text,
  color,
  textWidth,
  isOverlay,
}: {
  x: number
  y: number
  text: string
  color: string
  textWidth: number
  isOverlay?: boolean
}) {
  const theme = useTheme()
  return (
    <g transform={`translate(${x}, ${y})`}>
      {isOverlay ? (
        <rect
          x={-1}
          y={0}
          width={textWidth + 2}
          height={FONT_SIZE + 1}
          fill={stripAlpha(theme.palette.background.paper)}
          fillOpacity={0.8}
        />
      ) : null}
      <text x={0} y={FONT_SIZE} fontSize={FONT_SIZE} fill={color}>
        {text}
      </text>
    </g>
  )
}

export function SvgFloatingLabels({
  featureLabels,
  offsetPx,
  viewWidth,
}: Props) {
  return (
    <>
      {[...featureLabels.entries()].map(
        ([
          key,
          { leftPx, topPx, totalFeatureHeight, floatingLabels, featureWidth },
        ]) => {
          const featureVisualBottom = topPx + totalFeatureHeight
          const featureRightPx = leftPx + featureWidth
          return (
            <Fragment key={key}>
              {floatingLabels.map(
                ({ text, relativeY, color, textWidth, isOverlay }, i) => {
                  const x = calculateFloatingLabelPosition(
                    leftPx,
                    featureRightPx,
                    textWidth,
                    offsetPx,
                  )
                  return x >= 0 && x <= viewWidth ? (
                    <FloatingLabel
                      key={i}
                      x={x}
                      y={featureVisualBottom + relativeY}
                      text={text}
                      color={color}
                      textWidth={textWidth}
                      isOverlay={isOverlay}
                    />
                  ) : null
                },
              )}
            </Fragment>
          )
        },
      )}
    </>
  )
}
