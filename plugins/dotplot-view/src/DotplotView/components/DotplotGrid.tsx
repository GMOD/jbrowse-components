import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

// One line per block boundary, carrying the position it draws at. Blocks that
// round to the same pixel as the previous one are dropped — at whole-genome
// zoom hundreds of scaffolds land on the same column and would stack identical
// <line> elements (visible as a darker band in SVG export).
function gridLines(
  blocks: ContentBlock[],
  toPx: (block: ContentBlock) => number,
) {
  const out: { key: string; px: number }[] = []
  let prev: number | undefined
  for (const block of blocks) {
    const px = toPx(block)
    if (Math.floor(px) !== prev) {
      out.push({ key: block.key, px })
      prev = Math.floor(px)
    }
  }
  return out
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
  const stroke = theme.palette.divider

  // Clamp the rect to the viewport with Math.max/min: very large offscreen
  // SVG rects can sometimes fail to draw
  const rx = Math.max(hbottom, 0)
  const ry = Math.max(viewHeight - vtop, 0)
  const w = Math.min(htop - hbottom, viewWidth)
  const h = Math.min(viewHeight - vbottom - ry, viewHeight)

  const hlines = gridLines(hblocks, b => b.offsetPx - hview.offsetPx)
  const vlines = gridLines(
    vblocks,
    b => viewHeight - (b.offsetPx - vview.offsetPx),
  )

  // the far end of the last region on each axis, drawn only when it lands
  // inside the plot. Both surfaces clip it away otherwise, but the coordinates
  // run thousands of px out (see the rect clamp above), and in SVG export that
  // is serialized geometry nothing can ever see.
  const vy = viewHeight - vtop

  return (
    <>
      <rect
        x={rx}
        y={ry}
        width={w}
        height={h}
        {...getFillProps(theme.palette.background.default)}
      />
      {hlines.map(({ key, px }) => (
        <line
          key={key}
          x1={px}
          y1={0}
          x2={px}
          y2={viewHeight}
          {...getStrokeProps(stroke)}
        />
      ))}
      {vlines.map(({ key, px }) => (
        <line
          key={key}
          x1={0}
          y1={px}
          x2={viewWidth}
          y2={px}
          {...getStrokeProps(stroke)}
        />
      ))}
      {htop >= 0 && htop <= viewWidth ? (
        <line
          x1={htop}
          y1={0}
          x2={htop}
          y2={viewHeight}
          {...getStrokeProps(stroke)}
        />
      ) : null}
      {vy >= 0 && vy <= viewHeight ? (
        <line
          x1={0}
          y1={vy}
          x2={viewWidth}
          y2={vy}
          {...getStrokeProps(stroke)}
        />
      ) : null}
    </>
  )
})

// Plot backdrop plus the region grid. The backdrop is drawn here rather than as
// a CSS background on the on-screen <svg>, so SVG export gets it too: without
// it, area beyond the displayed regions exports as page background instead of
// the divider tint that says "no sequence here".
const DotplotGrid = observer(function DotplotGrid({
  model,
  children,
}: {
  model: DotplotViewModel
  children?: React.ReactNode
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
      {children}
    </>
  )
})

export default DotplotGrid
