import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

const YSCALEBAR_LABEL_OFFSET = 5

interface RecombinationTrackModel {
  recombination?: { values: number[]; positions: number[] }
  recombinationZoneHeight: number
}

/**
 * Recombination rate track displayed above the LD matrix
 * Shows 1 - r² between adjacent SNPs as a proxy for recombination
 *
 * Important: Uses index-based uniform positioning to align with the LD matrix,
 * not genomic coordinate-based positioning. The LD matrix uses uniform cell
 * widths regardless of genomic distance, so the recombination track must match.
 */
const RecombinationTrack = observer(function RecombinationTrack({
  model,
  recombination: recombinationProp,
  width,
  height,
  exportSVG,
}: {
  model?: RecombinationTrackModel
  recombination?: { values: number[]; positions: number[] }
  width: number
  height?: number
  exportSVG?: boolean
}) {
  const recombination = recombinationProp ?? model?.recombination
  const trackHeight = height ?? model?.recombinationZoneHeight ?? 50

  if (!recombination || recombination.values.length === 0) {
    return null
  }

  const topPadding = YSCALEBAR_LABEL_OFFSET
  const bottomPadding = YSCALEBAR_LABEL_OFFSET
  const plotHeight = trackHeight - topPadding - bottomPadding
  const maxValue = Math.max(...recombination.values, 0.1)

  // Number of SNPs = number of recombination values + 1
  // (there are n-1 values for n SNPs)
  const numSnps = recombination.values.length + 1

  // Build SVG path for the recombination line
  // Use index-based uniform positioning to align with the LD matrix
  const points: string[] = []
  let firstX: number | undefined
  let lastX: number | undefined

  for (let i = 0; i < recombination.values.length; i++) {
    const value = recombination.values[i]!

    // Position at midpoint between uniform SNP positions:
    // SNP i is at position (i + 0.5) / numSnps
    // SNP i+1 is at position (i + 1.5) / numSnps
    // Midpoint is at (i + 1) / numSnps
    const x = ((i + 1) * width) / numSnps
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
    const areaFill = getFillProps('rgba(59, 130, 246, 0.2)')
    const lineStroke = getStrokeProps('rgb(59, 130, 246)')

    return (
      <g>
        <path d={areaPath} {...areaFill} />
        <path
          d={points.join(' ')}
          fill="none"
          {...lineStroke}
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
      <path d={areaPath} fill="rgba(59, 130, 246, 0.2)" />
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
