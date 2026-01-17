import React, { useRef, useEffect, useCallback, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { LDDisplayModel } from '../model.ts'
import type { LDFlatbushItem } from '../../LDRenderer/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  canvas: {
    display: 'block',
  },
  legend: {
    position: 'absolute',
    top: 4,
    right: 4,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
  },
  legendGradient: {
    width: 100,
    height: 12,
    marginBottom: 2,
  },
  legendLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
  },
  tooltip: {
    position: 'absolute',
    background: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#666',
  },
})

const SQRT2 = Math.sqrt(2)

// Convert screen coordinates to unrotated matrix coordinates
function screenToUnrotated(
  screenX: number,
  screenY: number,
  yScalar: number,
  lineZoneHeight: number,
): { x: number; y: number } {
  // Account for the line zone offset
  const adjustedY = (screenY - lineZoneHeight) / yScalar
  // Inverse 45° rotation
  const x = (screenX - adjustedY) / SQRT2
  const y = (screenX + adjustedY) / SQRT2
  return { x, y }
}

const LDColorLegend = observer(function LDColorLegend({
  model,
}: {
  model: LDDisplayModel
}) {
  const { classes } = useStyles()
  const { ldMetric } = model

  // Create gradient style based on metric
  const gradientStyle =
    ldMetric === 'dprime'
      ? 'linear-gradient(to right, white, #8080ff, #0000a0)'
      : 'linear-gradient(to right, white, #ff8080, #a00000)'

  return (
    <div className={classes.legend}>
      <div
        className={classes.legendGradient}
        style={{ background: gradientStyle }}
      />
      <div className={classes.legendLabels}>
        <span>0</span>
        <span>{ldMetric === 'dprime' ? "D'" : 'R²'}</span>
        <span>1</span>
      </div>
    </div>
  )
})

const LDDisplayComponent = observer(function LDDisplayComponent({
  model,
}: {
  model: LDDisplayModel
}) {
  const { classes } = useStyles()
  const {
    height,
    error,
    loading,
    flatbush,
    flatbushItems,
    yScalar,
    lineZoneHeight,
    showLegend,
    ldMetric,
  } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const { width } = view

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    item: LDFlatbushItem
  } | null>(null)

  // Set canvas ref on model
  useEffect(() => {
    model.setRef(canvasRef.current)
    return () => {
      model.setRef(null)
    }
  }, [model])

  // Handle mousemove for tooltip
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!flatbush || !flatbushItems.length) {
        setTooltip(null)
        return
      }

      const rect = event.currentTarget.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top

      // Transform screen coordinates to matrix coordinates
      const { x, y } = screenToUnrotated(screenX, screenY, yScalar, lineZoneHeight)

      // Query Flatbush
      const fb = Flatbush.from(flatbush)
      const results = fb.search(x - 2, y - 2, x + 2, y + 2)

      if (results.length > 0) {
        const idx = results[0]!
        const item = flatbushItems[idx]
        if (item) {
          setTooltip({ x: screenX, y: screenY, item })
          return
        }
      }
      setTooltip(null)
    },
    [flatbush, flatbushItems, yScalar, lineZoneHeight],
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  if (error) {
    return (
      <div
        className={classes.container}
        style={{ height, width }}
      >
        <div className={classes.loading} style={{ color: 'red' }}>
          Error: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div
      className={classes.container}
      style={{ height, width }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        className={classes.canvas}
        width={width}
        height={height}
      />

      {loading && (
        <div className={classes.loading}>Computing LD...</div>
      )}

      {showLegend && !loading && <LDColorLegend model={model} />}

      {tooltip && (
        <div
          className={classes.tooltip}
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
          }}
        >
          <div>
            {ldMetric === 'dprime' ? "D'" : 'R²'}: {tooltip.item.ldValue.toFixed(3)}
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>
            {tooltip.item.snp1.id} × {tooltip.item.snp2.id}
          </div>
        </div>
      )}
    </div>
  )
})

export default LDDisplayComponent
