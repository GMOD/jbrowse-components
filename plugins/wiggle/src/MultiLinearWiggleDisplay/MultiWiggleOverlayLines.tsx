import { MIN_SEPARATOR_ROW_PX, RowSeparatorLines } from '@jbrowse/tree-sidebar'
import { CrossHatchLines } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { getRowTop } from '../shared/wiggleComponentUtils.ts'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Inter-row separator lines plus per-row Y-scale cross-hatches, shared by the
// live MultiWiggleComponent and the SVG export so the two can't drift. Both
// callers render this inside an <svg>, so it emits bare <line> fragments and
// takes the content width explicitly (CSS-pixel track width on screen vs view
// width on export).
interface OverlayModel {
  isOverlay: boolean
  isDensityMode: boolean
  showRowSeparators: boolean
  showCrossHatches: boolean
  numRows: number
  effectiveRowHeight: number
  ticks?: YScaleTicks
}

export default observer(function MultiWiggleOverlayLines({
  model,
  width,
}: {
  model: OverlayModel
  width: number
}) {
  const {
    isOverlay,
    isDensityMode,
    showRowSeparators,
    showCrossHatches,
    numRows,
    effectiveRowHeight,
    ticks,
  } = model
  // A subtle 1px hairline in the theme's divider color, shared with the
  // multi-row feature display (RowSeparatorLines, which owns the pixel rule).
  // Density rows are edge-to-edge fill, so the line is dialed up there to stay
  // visible over the saturated blocks; xyplot rows sit on paper, so it can be
  // fainter.
  //
  // numRows, like the cross hatches below: it is numSources outside overlay and
  // 1 inside it, so a single count drives both and they can't disagree about
  // where a row boundary is.
  const separators =
    !isOverlay && showRowSeparators ? (
      <RowSeparatorLines
        numRows={numRows}
        rowHeight={effectiveRowHeight}
        width={width}
        opacity={isDensityMode ? 0.3 : 0.15}
      />
    ) : null

  // overlay is one row over the full height (rowHeight === height, top === 0),
  // so its hatches draw once; multi-row repeats them per source.
  //
  // Floored at the same row height the separators are, and for the same reason:
  // below 100px `computeYTicks` gives a row only its domain min and max, so each
  // row's hatches sit on its own top and bottom edges — the separator grid,
  // drawn twice. Under `MIN_SEPARATOR_ROW_PX` those edges are no longer
  // distinguishable and 1,987 subtracks contribute 3,974 lines to the same
  // handful of pixels. Overlay is exempt because it is one row over the full
  // height, so its own height is the track's.
  const hatchesFit = isOverlay || effectiveRowHeight >= MIN_SEPARATOR_ROW_PX
  const crossHatches =
    showCrossHatches && ticks && hatchesFit
      ? Array.from({ length: numRows }).map((_, rowIdx) => (
          <CrossHatchLines
            // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one hatch set per source row
            key={`ch-${rowIdx}`}
            ticks={ticks}
            width={width}
            offsetY={getRowTop(rowIdx, effectiveRowHeight)}
          />
        ))
      : null

  return (
    <>
      {separators}
      {crossHatches}
    </>
  )
})
