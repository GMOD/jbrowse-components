import { DEFAULT_STROKE_WIDTH, HOVER_STROKE_WIDTH } from '../constants'

import type React from 'react'

interface InteractivePathProps extends React.SVGProps<SVGPathElement> {
  pathData: string
  isHovered?: boolean
  interactiveOverlay?: boolean
  onMouseOverCallback?: () => void
  onMouseOutCallback?: () => void
  strokeWidth?: number
  hoverStrokeWidth?: number
}

export default function InteractivePath({
  pathData,
  isHovered = false,
  interactiveOverlay,
  onMouseOverCallback,
  onMouseOutCallback,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  hoverStrokeWidth = HOVER_STROKE_WIDTH,
  ...otherProps
}: InteractivePathProps) {
  return (
    <path
      d={pathData}
      strokeWidth={isHovered ? hoverStrokeWidth : strokeWidth}
      pointerEvents={interactiveOverlay ? 'auto' : undefined}
      onMouseOver={onMouseOverCallback}
      onMouseOut={onMouseOutCallback}
      {...otherProps}
    />
  )
}
