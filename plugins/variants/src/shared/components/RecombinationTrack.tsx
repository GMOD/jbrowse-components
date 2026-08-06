import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
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

/**
 * Recombination rate track displayed above the LD matrix. Shows 1 - r² between
 * adjacent SNPs as a proxy for recombination.
 *
 * Takes its x coordinates already laid out (`SharedLDModel.recombinationCoords`)
 * rather than deriving them here: index mode has to ride the matrix's own frame
 * — the fetch-time column pitch through `renderTransform` — which is model
 * state, and laying points out across the live width instead drifted the curve
 * off the columns it labels.
 */
const RecombinationTrack = observer(function RecombinationTrack({
  points,
  maxValue,
  width,
  height,
  exportSVG,
}: {
  // one per adjacent SNP pair, in viewport pixels; a non-finite x (off-screen
  // locus) or value (unmeasured pair) is skipped and breaks the line
  points: { x: number; value: number }[]
  maxValue: number
  width: number
  height: number
  exportSVG?: boolean
}) {
  const topPadding = YSCALEBAR_LABEL_OFFSET
  const bottomPadding = YSCALEBAR_LABEL_OFFSET
  const plotHeight = height - topPadding - bottomPadding

  const plotted: [number, number][] = []
  for (const { x, value } of points) {
    // Skip unmeasured (NaN) pairs rather than plotting a spurious spike. One or
    // two skipped in a row is jitter the line should span; a long run of them is
    // a hole, which `runs` below breaks on.
    if (Number.isFinite(value) && Number.isFinite(x)) {
      plotted.push([x, topPadding + plotHeight * (1 - value / maxValue)])
    }
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
        height,
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
