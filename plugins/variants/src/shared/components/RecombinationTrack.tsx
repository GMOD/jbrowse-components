import { getFillProps, getStrokeProps, maxFinite } from '@jbrowse/core/util'
import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'
import { YSCALEBAR_LABEL_OFFSET, gapBreakLimit } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

const FILL_COLOR = 'rgba(59, 130, 246, 0.2)'
const STROKE_COLOR = 'rgb(59, 130, 246)'

// How many mean point spacings apart two measurements must sit before the span
// between them counts as a hole rather than a segment to draw (see
// gapBreakLimit). Deliberately NOT the wiggle plugin's constant, though both
// happen to land on 20: a wiggle series is tiled bins, this one is an irregular
// point process, and sharing one number meant retuning for one caller silently
// retuned the other.
//
// Calibrated on the LCT locus, the figure this curve is read in: 1401
// MAF-filtered SNPs over 3.1 Mb, spacing that is not uniform but a heavy right
// tail — median gap 996 bp against a 2354 bp mean, dense stretches and sparse
// ones in one window, with no bimodal split between "typical" and "hole" to aim
// at. Breaks by threshold there:
//
//   5x  -> 47, the curve shatters into dots wherever local density runs under
//          the global average. This was the first value shipped and it was
//          plainly wrong the moment the figure was rendered.
//   10x -> 17, still reads as dashed
//   20x -> 2, the two longest bridged spans (73.1 kb and 66.6 kb). The next gap
//          down is 43.7 kb, so 20x lands inside a real gap in the tail rather
//          than slicing through a run of comparable spans.
//
// If a future dataset over-breaks, this is the one number to move, and the
// figure is the way to check it — the shape of the tail is not something the
// unit tests can tell you.
const RECOMBINATION_GAP_MULTIPLE = 20

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

  // Number of SNPs = number of recombination values + 1 (n-1 values for n SNPs)
  const numSnps = recombination.values.length + 1

  const plotted: [number, number][] = []
  for (let i = 0; i < recombination.values.length; i++) {
    const value = recombination.values[i]!
    // Skip unmeasured (NaN) pairs rather than plotting a spurious spike. One or
    // two skipped in a row is jitter the line should span; a long run of them is
    // a hole, which `runs` below breaks on.
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
    plotted.push([x, topPadding + plotHeight * (1 - value / maxValue)])
  }

  if (plotted.length < 2) {
    return null
  }

  // Split into runs at the holes. Without this the curve joined the two sides of
  // a long unmeasured stretch with one straight diagonal — a shape that reads as
  // a real trend across a span where nothing was measured at all. Measured in px
  // (the space this strip is laid out in) against the curve's own mean point
  // spacing, so it holds whether x came from genomic positions or from the
  // uniform index layout, where a run of k skipped pairs is k times the pitch.
  // Same rule the wiggle plugin's interpolated line uses (gapBreakLimit), on
  // this curve's own multiple.
  const gapLimitPx = gapBreakLimit({
    first: plotted[0]![0],
    last: plotted.at(-1)![0],
    count: plotted.length,
    multiple: RECOMBINATION_GAP_MULTIPLE,
  })
  const runs: [number, number][][] = [[]]
  for (const [i, point] of plotted.entries()) {
    if (i > 0 && point[0] - plotted[i - 1]![0] > gapLimitPx) {
      runs.push([])
    }
    runs.at(-1)!.push(point)
  }

  const draw = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`
  // A single-point run still emits its zero-length segment so the round cap
  // paints it as a dot — otherwise an isolated measurement between two holes
  // disappears entirely.
  const linePath = runs
    .map(run => `M ${draw(run[0]!)} ${run.map(p => `L ${draw(p)}`).join(' ')}`)
    .join(' ')

  // Each run closes its own area, so the fill stops at the hole instead of
  // sweeping under it.
  const baseY = topPadding + plotHeight
  const areaPath = runs
    .map(
      run =>
        `M ${run[0]![0].toFixed(1)} ${baseY.toFixed(1)} ` +
        `${run.map(p => `L ${draw(p)}`).join(' ')} ` +
        `L ${run.at(-1)![0].toFixed(1)} ${baseY.toFixed(1)} Z`,
    )
    .join(' ')

  // For SVG export, use getFillProps/getStrokeProps to separate alpha into opacity
  if (exportSVG) {
    return (
      <g>
        <path d={areaPath} {...getFillProps(FILL_COLOR)} />
        <path
          d={linePath}
          fill="none"
          {...getStrokeProps(STROKE_COLOR)}
          strokeWidth={1.5}
          strokeLinecap="round"
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
        d={linePath}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
})

export default RecombinationTrack
