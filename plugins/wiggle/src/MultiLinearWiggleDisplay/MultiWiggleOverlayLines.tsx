import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getStrokeProps } from '@jbrowse/core/util'
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
  const palette = usePalette()

  // A subtle 1px hairline in the theme's divider color. Density rows are
  // edge-to-edge fill, so the line is dialed up there to stay visible over the
  // saturated blocks; xyplot rows sit on paper, so it can be fainter.
  // getStrokeProps splits the alpha onto a separate stroke-opacity attribute so
  // it survives the SVG export (renderToStaticMarkup strips rgba() alpha),
  // keeping the live view and export identical. See CrossHatches.
  // numRows, like the cross hatches below: it is numSources outside overlay and
  // 1 inside it, so a single count drives both and they can't disagree about
  // where a row boundary is.
  const separators =
    !isOverlay && showRowSeparators && numRows > 1
      ? Array.from({ length: numRows - 1 }).map((_, idx) => {
          // floor, not round: the line covers the pixel the boundary falls in,
          // and round is a pixel too low once the fractional part reaches 0.5
          // — visible in density mode, where the rows are saturated fills that
          // blend into that pixel. Half-pixel offset so the 1px stroke fills
          // one pixel rather than straddling two. Same reasoning as the
          // multi-row painter's MultiRowSeparatorLines.
          const y = Math.floor(getRowTop(idx + 1, effectiveRowHeight)) + 0.5
          return (
            <line
              // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one separator per row boundary
              key={`sep-${idx}`}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              {...getStrokeProps(
                alpha(palette.divider, isDensityMode ? 0.3 : 0.15),
              )}
              strokeWidth={1}
            />
          )
        })
      : null

  // overlay is one row over the full height (rowHeight === height, top === 0),
  // so its hatches draw once; multi-row repeats them per source.
  const crossHatches =
    showCrossHatches && ticks
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
