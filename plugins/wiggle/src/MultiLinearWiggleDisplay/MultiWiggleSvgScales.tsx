import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreDomainCaption, {
  SCORE_CAPTION_HEIGHT,
} from '../shared/ScoreDomainCaption.tsx'
import { getRowTop } from '../shared/wiggleComponentUtils.ts'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

const AXIS_TO_LABEL_GAP_PX = 4

// Whether the per-row axes draw at all: density encodes score as color, and a
// short row has no room for an axis. A domain is what makes any scale real.
function axesShown(model: CaptionModel) {
  return (
    !!model.domain &&
    !model.isDensityMode &&
    !model.rowHeightTooSmallForScalebar
  )
}

// Whether the `[min, max]` caption stands in for them. Not under a density
// ramp: that ramp is the chrome's key and carries the domain on its own bar.
function captionShown(model: CaptionModel) {
  return !!model.domain && !axesShown(model) && !model.scoreRampApplies
}

interface CaptionModel {
  domain: [number, number] | undefined
  isDensityMode: boolean
  rowHeightTooSmallForScalebar: boolean
  scoreRampApplies: boolean
}

/**
 * Px the score caption occupies at the top-right, which the chrome's key
 * starts below (`legendTop`): both are pinned to the content's right edge and
 * both draw from y=0, and they apply together in exactly the case the key was
 * widened for — a density track whose rows are too short to label.
 */
export function scoreCaptionReservedPx(model: CaptionModel) {
  return captionShown(model) ? SCORE_CAPTION_HEIGHT : 0
}

// Row labels (non-overlay mode) plus the per-row axes or their caption, shared
// by the live MultiWiggleComponent and the SVG export path so the two can't
// drift. The color key is NOT here: it is the chrome's, off `colorScales`.
// Callers pass their own `legendRight`/`scalebarLeft`/`labelOffset` (the axis
// indent differs between screen and export, see ONSCREEN_AXIS_LEFT_PX).
interface ScaleModel extends CaptionModel {
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
    group?: string
  }[]
  isOverlay: boolean
  effectiveRowHeight: number
  scaleType: string
  ticks?: YScaleTicks
  numSources: number
  numRows: number
  showRowLabels: boolean
}

export default observer(function MultiWiggleSvgScales({
  model,
  legendRight,
  scalebarLeft,
  labelOffset,
}: {
  model: ScaleModel
  // x the right-aligned score caption is pinned to (the content's right edge)
  legendRight: number
  // right edge of the per-row axes: they are left-oriented, so their ticks and
  // numbers grow leftward from here
  scalebarLeft: number
  // x the row labels start at, before any axis clearance
  labelOffset: number
}) {
  const {
    sources,
    isOverlay,
    effectiveRowHeight,
    domain,
    scaleType,
    ticks,
    numSources,
    numRows,
    showRowLabels,
  } = model

  const scalebarsShown = axesShown(model)

  // The axes are left-oriented, so their ticks and numbers occupy the strip
  // that ends at `scalebarLeft`. Row labels start after that strip rather than
  // under it: a sample name can be arbitrarily long, so the axis takes the
  // fixed-width side and the labels keep growing rightward over the plot.
  const labels =
    numSources > 1 && !isOverlay && showRowLabels ? (
      <SvgRowLabels
        sources={sources}
        rowHeight={effectiveRowHeight}
        labelOffset={
          scalebarsShown
            ? Math.max(labelOffset, scalebarLeft + AXIS_TO_LABEL_GAP_PX)
            : labelOffset
        }
      />
    ) : null

  // A domain is what makes any scale real (`ticks` derives from it, so the axis
  // branch needs no separate tick guard), which is why the no-domain case is one
  // early null rather than a guard on each branch. Overlay is one row over the
  // full height (rowHeight === height, so getRowTop(0) === 0); multi-row draws
  // one scalebar per source down the track.
  const scalebars = !domain ? null : scalebarsShown ? (
    <g transform={`translate(${scalebarLeft})`}>
      {Array.from({ length: numRows }).map((_, idx) => (
        <g
          // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one scalebar per source row
          key={`scalebar-${idx}`}
          transform={`translate(0 ${getRowTop(idx, effectiveRowHeight)})`}
        >
          {/* insetLabels because these rows stack edge to edge (`ticks` is
              built with offset 0, see the model): a label centered on a row's
              own top or bottom tick straddles the boundary, so the first row's
              top label and the last row's bottom label are half-clipped by the
              track's <svg> and every boundary between them draws two labels on
              the same pixels. */}
          <YScaleBar ticks={ticks} orientation="left" insetLabels />
        </g>
      ))}
    </g>
  ) : captionShown(model) ? (
    <ScoreDomainCaption
      domain={domain}
      scaleType={scaleType}
      canvasWidth={legendRight}
    />
  ) : null

  return (
    <>
      {labels}
      {scalebars}
    </>
  )
})
