import React, { useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { Region } from '@jbrowse/core/util/types'

const HicRendering = observer(function HicRendering(props: {
  blockKey: string
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  scoreMatrix?: number[][]
}) {
  const { width, height, scoreMatrix } = props
  const canvasWidth = Math.ceil(width)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (event: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setMousePos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }
  }

  const handleMouseLeave = () => {
    setMousePos(null)
  }

  const getMatrixScore = (x: number, y: number): number | null => {
    if (!scoreMatrix?.length) {
      return null
    }

    const matrixSize = scoreMatrix.length
    const xIndex = Math.floor((x / width) * matrixSize)
    const yIndex = Math.floor((y / height) * matrixSize)

    if (
      xIndex < 0 ||
      yIndex < 0 ||
      xIndex >= matrixSize ||
      yIndex >= matrixSize
    ) {
      return null
    }

    if (yIndex > xIndex) {
      return null
    }

    return scoreMatrix[yIndex]?.[xIndex] ?? null
  }

  const currentScore = mousePos ? getMatrixScore(mousePos.x, mousePos.y) : null

  // need to call this in render so we get the right observer behavior
  return (
    <Tooltip
      title={currentScore !== null ? `Score: ${currentScore}` : ''}
      open={mousePos !== null && currentScore !== null}
      placement="top"
      arrow
    >
      <div
        ref={containerRef}
        style={{ position: 'relative', width: canvasWidth, height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <PrerenderedCanvas
          {...props}
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
        {mousePos && (
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: canvasWidth,
              height,
              pointerEvents: 'none',
            }}
          >
            <g stroke="#000" strokeWidth="1" fill="none">
              <path
                d={`M ${mousePos.x - mousePos.y} 0 L ${mousePos.x} ${mousePos.y} L ${mousePos.x + mousePos.y} 0`}
              />
            </g>
          </svg>
        )}
      </div>
    </Tooltip>
  )
})

export default HicRendering
