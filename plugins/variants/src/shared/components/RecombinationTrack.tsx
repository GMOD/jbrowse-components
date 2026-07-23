import { getFillProps, getStrokeProps, maxFinite } from '@jbrowse/core/util'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { bpOffsetInRegion } from '../../RenderLDDataRPC/reversedRegions.ts'

const FILL_COLOR = 'rgba(59, 130, 246, 0.2)'
const STROKE_COLOR = 'rgb(59, 130, 246)'

interface RecombinationTrackModel {
  recombination?: { values: ArrayLike<number>; positions: number[] }
  recombinationZoneHeight: number
}

/**
 * Recombination rate track displayed above the LD matrix
 * Shows 1 - r² between adjacent SNPs as a proxy for recombination
 *
 * When useGenomicPositions is false: Uses index-based uniform positioning to
 * align with the LD matrix (uniform cell widths regardless of genomic distance)
 *
 * When useGenomicPositions is true: Uses actual genomic positions to plot
 * the recombination values at their true base pair locations
 */
const RecombinationTrack = observer(function RecombinationTrack({
  model,
  recombination: recombinationProp,
  width,
  height,
  exportSVG,
  useGenomicPositions,
  region,
  bpPerPx,
}: {
  model?: RecombinationTrackModel
  recombination?: { values: ArrayLike<number>; positions: number[] }
  width: number
  height?: number
  exportSVG?: boolean
  useGenomicPositions?: boolean
  // The displayed block the values are plotted against; reversed blocks measure
  // from their end, so the plot tracks the ruler on a flipped view.
  region?: { start: number; end: number; reversed?: boolean }
  bpPerPx?: number
}) {
  const recombination = recombinationProp ?? model?.recombination
  const trackHeight = height ?? model?.recombinationZoneHeight ?? 50

  if (!recombination || recombination.values.length === 0) {
    return null
  }

  const topPadding = YSCALEBAR_LABEL_OFFSET
  const bottomPadding = YSCALEBAR_LABEL_OFFSET
  const plotHeight = trackHeight - topPadding - bottomPadding
  // Absent adjacent pairs from a thresholded pre-computed LD file are NaN
  // (unmeasured); maxFinite ignores them so one gap can't blow up the scale.
  const maxValue = maxFinite(recombination.values, 0.1)

  // Build SVG path for the recombination line
  const points: string[] = []
  let firstX: number | undefined
  let lastX: number | undefined
  // Number of SNPs = number of recombination values + 1 (n-1 values for n SNPs)
  const numSnps = recombination.values.length + 1

  for (let i = 0; i < recombination.values.length; i++) {
    const value = recombination.values[i]!
    // Skip unmeasured (NaN) pairs: the line bridges the gap rather than drawing a
    // spurious spike, and the index-based x still aligns with the SNP columns.
    if (!Number.isFinite(value)) {
      continue
    }
    let x: number
    if (useGenomicPositions && region && bpPerPx) {
      // positions[i] is already the midpoint between SNP i and SNP i+1
      x = bpOffsetInRegion(region, recombination.positions[i]!) / bpPerPx
    } else {
      // Uniform positioning: midpoint at (i + 1) / numSnps
      x = ((i + 1) * width) / numSnps
    }
    const y = topPadding + plotHeight * (1 - value / maxValue)
    firstX ??= x
    lastX = x
    points.push(
      `${points.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`,
    )
  }

  if (points.length < 2 || firstX === undefined || lastX === undefined) {
    return null
  }

  // Create area path (fill under the line)
  const baseY = topPadding + plotHeight
  const areaPath = `${points.join(' ')} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`

  // For SVG export, use getFillProps/getStrokeProps to separate alpha into opacity
  if (exportSVG) {
    return (
      <g>
        <path d={areaPath} {...getFillProps(FILL_COLOR)} />
        <path
          d={points.join(' ')}
          fill="none"
          {...getStrokeProps(STROKE_COLOR)}
          strokeWidth={1.5}
        />
      </g>
    )
  }

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
      <path d={areaPath} fill={FILL_COLOR} />
      <path
        d={points.join(' ')}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={1.5}
      />
    </svg>
  )
})

export default RecombinationTrack
