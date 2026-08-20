import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'
import type { TickLine } from './util.ts'

// Both axes' gridlines collapse into one <path> per weight, the way
// LinearGenomeView's do: a whole-genome plot can carry a couple of hundred of
// them, and two `d` strings redraw on a pan instead of that many <line> nodes
// reconciling. The horizontal axis' lines run down the plot, the vertical
// axis' across it, and they share a path because they share a stroke.
function gridPath(
  hlines: TickLine[],
  vlines: TickLine[],
  major: boolean,
  viewWidth: number,
  viewHeight: number,
) {
  return [
    ...hlines
      .filter(l => l.major === major)
      .map(l => `M${l.px} 0V${viewHeight}`),
    ...vlines
      .filter(l => l.major === major)
      .map(l => `M0 ${l.px}H${viewWidth}`),
  ].join('')
}

// Mounted only under `hasVisibleRegions`, which is what makes each axis's first
// block (the near end of its backdrop rect) safe to read.
const RegionGrid = observer(function RegionGrid({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, viewHeight, hview, vview } = model
  const hblocks = hview.dynamicBlocks.contentBlocks
  const vblocks = vview.dynamicBlocks.contentBlocks
  const theme = useTheme()
  const htop = hview.displayedRegionsTotalPx - hview.offsetPx
  const vtop = vview.displayedRegionsTotalPx - vview.offsetPx
  const hbottom = hblocks[0]!.offsetPx - hview.offsetPx
  const vbottom = vblocks[0]!.offsetPx - vview.offsetPx
  // `regionBoundary`, not the divider tint this used to draw at: that tint is
  // lighter than a MAJOR gridline, which made the chromosome seam disappear into
  // a plot that now draws fifty lines — and the seam is the landmark every
  // coordinate here hangs off.
  const stroke = theme.palette.regionBoundary

  // Clamp both of the rect's edges to the viewport and take the span between
  // them — very large offscreen SVG rects can sometimes fail to draw. Sizing it
  // from the unclamped span instead (`htop - hbottom`) let the backdrop run past
  // the far end of the genome by however much the near end was offscreen: only
  // ever reachable if `dynamicBlocks` stopped being viewport-clipped, but it is
  // the rule the vertical axis already follows and one fewer thing to hold true.
  const rx = Math.max(hbottom, 0)
  const ry = Math.max(viewHeight - vtop, 0)
  const w = Math.max(Math.min(htop, viewWidth) - rx, 0)
  const h = Math.max(Math.min(viewHeight - vbottom, viewHeight) - ry, 0)

  // Both line sets come from the model: the SVG export renders this same
  // component, and the gridlines have to be able to see which pixels a boundary
  // already owns. Gridlines first, so a boundary wins any pixel they still end
  // up sharing.
  const { hRegionLines, vRegionLines, hGridlines, vGridlines } = model
  const minorD = gridPath(hGridlines, vGridlines, false, viewWidth, viewHeight)
  const majorD = gridPath(hGridlines, vGridlines, true, viewWidth, viewHeight)

  return (
    <>
      <rect
        x={rx}
        y={ry}
        width={w}
        height={h}
        {...getFillProps(theme.palette.background.default)}
      />
      <path
        d={minorD}
        fill="none"
        strokeWidth={1}
        {...getStrokeProps(theme.palette.plotGridlineMinor)}
      />
      <path
        d={majorD}
        fill="none"
        strokeWidth={1}
        {...getStrokeProps(theme.palette.plotGridlineMajor)}
      />
      {hRegionLines.map(({ key, px }) => (
        <line
          key={key}
          x1={px}
          y1={0}
          x2={px}
          y2={viewHeight}
          {...getStrokeProps(stroke)}
        />
      ))}
      {vRegionLines.map(({ key, px }) => (
        <line
          key={key}
          x1={0}
          y1={px}
          x2={viewWidth}
          y2={px}
          {...getStrokeProps(stroke)}
        />
      ))}
    </>
  )
})

// Plot backdrop plus the region grid. The backdrop is drawn here rather than as
// a CSS background on the on-screen <svg>, so SVG export gets it too: without
// it, area beyond the displayed regions exports as page background instead of
// the divider tint that says "no sequence here".
const DotplotGrid = observer(function DotplotGrid({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, viewHeight, hasVisibleRegions } = model
  const theme = useTheme()
  return (
    <>
      <rect
        width={viewWidth}
        height={viewHeight}
        {...getFillProps(theme.palette.divider)}
      />
      {hasVisibleRegions ? <RegionGrid model={model} /> : null}
    </>
  )
})

export default DotplotGrid
