import { getFillProps, getStrokeProps, max } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

const YSCALEBAR_LABEL_OFFSET = 5
const FILL_COLOR = 'rgba(59, 130, 246, 0.2)'
const STROKE_COLOR = 'rgb(59, 130, 246)'

interface RecombinationTrackModel {
  recombination?: { values: number[]; positions: number[] }
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
  regionStart,
  bpPerPx,
}: {
  model?: RecombinationTrackModel
  recombination?: { values: number[]; positions: number[] }
  width: number
  height?: number
  exportSVG?: boolean
  useGenomicPositions?: boolean
  regionStart?: number
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
  const maxValue = max(recombination.values, 0.1)

  // Build SVG path for the recombination line
  const points: string[] = []
  let firstX: number | undefined
  let lastX: number | undefined
  // Number of SNPs = number of recombination values + 1 (n-1 values for n SNPs)
  const numSnps = recombination.values.length + 1

  for (let i = 0; i < recombination.values.length; i++) {
    const value = recombination.values[i]!
    let x: number
    // eslint-disable-next-line unicorn/prefer-ternary
    if (useGenomicPositions && regionStart !== undefined && bpPerPx) {
      // positions[i] is already the midpoint between SNP i and SNP i+1
      x = (recombination.positions[i]! - regionStart) / bpPerPx
    } else {
      // Uniform positioning: midpoint at (i + 1) / numSnps
      x = ((i + 1) * width) / numSnps
    }
    const y = topPadding + plotHeight * (1 - value / maxValue)
    if (firstX === undefined) {
      firstX = x
    }
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
