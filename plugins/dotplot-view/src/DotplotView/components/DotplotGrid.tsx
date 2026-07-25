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

const DotplotGrid = observer(function DotplotGrid({
  model,
  children,
}: {
  model: DotplotViewModel
  children?: React.ReactNode
}) {
  const { viewWidth, viewHeight, hview, vview } = model
  const hblocks = hview.dynamicBlocks.contentBlocks
  const vblocks = vview.dynamicBlocks.contentBlocks
  const theme = useTheme()
  if (!hblocks.length || !vblocks.length) {
    return null
  }
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

  return (
    <>
      <rect
        x={rx}
        y={ry}
        width={w}
        height={h}
        {...getFillProps(theme.palette.background.default)}
      />
      <g>
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
        <line
          x1={htop}
          y1={0}
          x2={htop}
          y2={viewHeight}
          {...getStrokeProps(stroke)}
        />
        <line
          x1={0}
          y1={viewHeight - vtop}
          x2={viewWidth}
          y2={viewHeight - vtop}
          {...getStrokeProps(stroke)}
        />
      </g>
      {children}
    </>
  )
})

export default DotplotGrid
