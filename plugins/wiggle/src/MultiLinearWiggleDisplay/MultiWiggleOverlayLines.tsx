import { getStrokeProps } from '@jbrowse/core/util'
import { CrossHatchLines } from '@jbrowse/wiggle-core'
import { alpha, useTheme } from '@mui/material'
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
  displayCrossHatches: boolean
  numSources: number
  rowHeight: number
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
    displayCrossHatches,
    numSources,
    rowHeight,
    ticks,
  } = model
  const theme = useTheme()

  // A subtle 1px hairline in the theme's divider color. Density rows are
  // edge-to-edge fill, so the line is dialed up there to stay visible over the
  // saturated blocks; xyplot rows sit on paper, so it can be fainter.
  // getStrokeProps splits the alpha onto a separate stroke-opacity attribute so
  // it survives the SVG export (renderToStaticMarkup strips rgba() alpha),
  // keeping the live view and export identical. See CrossHatches.
  const separators =
    !isOverlay && showRowSeparators && numSources > 1
      ? Array.from({ length: numSources - 1 }).map((_, idx) => {
          // +0.5 lands the 1px stroke on a device-pixel boundary so it renders
          // crisp instead of anti-aliased across two rows.
          const y = Math.round(getRowTop(idx + 1, rowHeight)) + 0.5
          return (
            <line
              // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one separator per row boundary
              key={`sep-${idx}`}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              {...getStrokeProps(
                alpha(theme.palette.divider, isDensityMode ? 0.3 : 0.15),
              )}
              strokeWidth={1}
            />
          )
        })
      : null

  // overlay draws one set of hatches over the full height (rowHeight === height,
  // top === 0); rows repeat them per source.
  const crossHatches =
    displayCrossHatches && ticks
      ? Array.from({ length: isOverlay ? 1 : numSources }).map((_, rowIdx) => (
          <CrossHatchLines
            // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one hatch set per source row
            key={`ch-${rowIdx}`}
            ticks={ticks}
            width={width}
            offsetY={getRowTop(rowIdx, rowHeight)}
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
