import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { Y_AXIS_WIDTH } from './RecombinationYScaleBar.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RecombinationTrackModel {
  recombination?: { values: number[]; positions: number[] }
  recombinationZoneHeight: number
}

/**
 * Recombination rate track displayed above the LD matrix
 * Shows 1 - r² between adjacent SNPs as a proxy for recombination
 * Note: The Y-axis scalebar is rendered separately via RecombinationYScaleBar
 */
const RecombinationTrack = observer(function RecombinationTrack({
  model,
  width,
  height,
}: {
  model: RecombinationTrackModel
  width: number
  height?: number
}) {
  const view = getContainingView(model) as LGV
  const { recombination } = model
  const trackHeight = height ?? model.recombinationZoneHeight

  if (!recombination || recombination.values.length === 0) {
    return null
  }

  const region = view.dynamicBlocks.contentBlocks[0]
  if (!region) {
    return null
  }

  const { bpPerPx } = view
  const topPadding = 5
  const bottomPadding = 5
  const plotHeight = trackHeight - topPadding - bottomPadding
  const plotLeft = Y_AXIS_WIDTH
  const plotWidth = width - Y_AXIS_WIDTH
  const maxValue = Math.max(...recombination.values, 0.1)

  // Build SVG path for the recombination line
  const points: string[] = []
  let firstX: number | undefined
  let lastX: number | undefined

  for (let i = 0; i < recombination.values.length; i++) {
    const pos = recombination.positions[i]!
    const value = recombination.values[i]!
    const x = plotLeft + (pos - region.start) / bpPerPx
    const y = topPadding + plotHeight * (1 - value / maxValue)

    if (x >= plotLeft && x <= width) {
      if (firstX === undefined) {
        firstX = x
      }
      lastX = x
      points.push(
        `${points.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`,
      )
    }
  }

  if (points.length < 2 || firstX === undefined || lastX === undefined) {
    return null
  }

  // Create area path (fill under the line)
  const baseY = topPadding + plotHeight
  const areaPath = `${points.join(' ')} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height: trackHeight,
        pointerEvents: 'none',
      }}
    >
      {/* Background for the plot area */}
      <rect
        x={plotLeft}
        y={topPadding}
        width={plotWidth}
        height={plotHeight}
        fill="rgba(0,0,0,0.02)"
      />

      {/* Filled area under the curve */}
      <path d={areaPath} fill="rgba(59, 130, 246, 0.2)" />

      {/* Line showing recombination rate */}
      <path
        d={points.join(' ')}
        fill="none"
        stroke="rgb(59, 130, 246)"
        strokeWidth={1.5}
      />
    </svg>
  )
})

export default RecombinationTrack

export { Y_AXIS_WIDTH } from './RecombinationYScaleBar.tsx'
