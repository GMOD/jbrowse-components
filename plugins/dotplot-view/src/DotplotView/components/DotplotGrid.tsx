import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

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

  // Uses math.max/min avoid making very large SVG rect offscreen element,
  // which can sometimes fail to draw
  const rx = Math.max(hbottom, 0)
  const ry = Math.max(viewHeight - vtop, 0)
  const w = Math.min(htop - hbottom, viewWidth)
  const h = Math.min(viewHeight - vbottom - ry, viewHeight)

  // Filter blocks to avoid rendering duplicate lines at the same pixel position
  const hlines = hblocks.filter((region, idx) => {
    const x = Math.floor(region.offsetPx - hview.offsetPx)
    const prevX =
      idx > 0 ? Math.floor(hblocks[idx - 1]!.offsetPx - hview.offsetPx) : null
    return x !== prevX
  })
  const vlines = vblocks.filter((region, idx) => {
    const y = Math.floor(viewHeight - (region.offsetPx - vview.offsetPx))
    const prevY =
      idx > 0
        ? Math.floor(viewHeight - (vblocks[idx - 1]!.offsetPx - vview.offsetPx))
        : null
    return y !== prevY
  })

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
        {hlines.map(region => {
          const x = region.offsetPx - hview.offsetPx
          return (
            <line
              key={region.key}
              x1={x}
              y1={0}
              x2={x}
              y2={viewHeight}
              {...getStrokeProps(stroke)}
            />
          )
        })}
        {vlines.map(region => {
          const y = viewHeight - (region.offsetPx - vview.offsetPx)
          return (
            <line
              key={region.key}
              x1={0}
              y1={y}
              x2={viewWidth}
              y2={y}
              {...getStrokeProps(stroke)}
            />
          )
        })}
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
