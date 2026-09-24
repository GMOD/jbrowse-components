import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getFillProps, getStrokeProps, minmax } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { DotplotPlotAxisModel } from '../1dview.ts'
import type { DotplotViewModel } from '../model.ts'
import type { TickLine } from './util.ts'

// The screen span an axis' displayed regions cover, clamped to the plot: very
// large offscreen SVG rects can fail to draw, and clamping only the near edge
// let the backdrop run past the far end of the genome by however much the near
// end was offscreen. Reads the axis' first block, which `hasVisibleRegions`
// guarantees.
function coveredSpan(axis: DotplotPlotAxisModel) {
  const { offsetPx, displayedRegionsTotalPx, width } = axis
  const [lo, hi] = minmax(
    axis.toScreenPx(axis.dynamicBlocks.contentBlocks[0]!.offsetPx - offsetPx),
    axis.toScreenPx(displayedRegionsTotalPx - offsetPx),
  )
  const start = Math.max(lo, 0)
  return { start, size: Math.max(Math.min(hi, width) - start, 0) }
}

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

// Mounted only under `hasVisibleRegions`
const RegionGrid = observer(function RegionGrid({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, viewHeight, hview, vview } = model
  const palette = usePalette()
  // `regionBoundary`, not the divider tint this used to draw at: that tint is
  // lighter than a MAJOR gridline, which made the chromosome seam disappear into
  // a plot that now draws fifty lines — and the seam is the landmark every
  // coordinate here hangs off.
  const stroke = palette.regionBoundary

  const x = coveredSpan(hview)
  const y = coveredSpan(vview)

  // Both line sets come from the model: the SVG export renders this same
  // component, and the gridlines have to be able to see which pixels a boundary
  // already owns. Gridlines first, so a boundary wins any pixel they still end
  // up sharing.
  const { regionLines: hRegionLines, gridlines: hGridlines } = hview
  const { regionLines: vRegionLines, gridlines: vGridlines } = vview
  const minorD = gridPath(hGridlines, vGridlines, false, viewWidth, viewHeight)
  const majorD = gridPath(hGridlines, vGridlines, true, viewWidth, viewHeight)

  return (
    <>
      <rect
        x={x.start}
        y={y.start}
        width={x.size}
        height={y.size}
        {...getFillProps(palette.background.default)}
      />
      <path
        d={minorD}
        fill="none"
        strokeWidth={1}
        {...getStrokeProps(palette.plotGridlineMinor)}
      />
      <path
        d={majorD}
        fill="none"
        strokeWidth={1}
        {...getStrokeProps(palette.plotGridlineMajor)}
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
  const palette = usePalette()
  return (
    <>
      <rect
        width={viewWidth}
        height={viewHeight}
        {...getFillProps(palette.divider)}
      />
      {hasVisibleRegions ? <RegionGrid model={model} /> : null}
    </>
  )
})

export default DotplotGrid
