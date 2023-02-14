import React from 'react'
import { observer } from 'mobx-react'
import { useTheme } from '@mui/material'

// locals
import { DotplotViewModel } from '../model'

export const GridRaw = observer(function ({
  model,
  children,
}: {
  model: DotplotViewModel
  children?: React.ReactNode
}) {
  const { viewWidth, viewHeight, hview, vview } = model
  const hblocks = hview.dynamicBlocks.contentBlocks
  const vblocks = vview.dynamicBlocks.contentBlocks
  if (!hblocks.length || !vblocks.length) {
    return null
  }
  const htop = hview.displayedRegionsTotalPx - hview.offsetPx
  const vtop = vview.displayedRegionsTotalPx - vview.offsetPx
  const hbottom = hblocks[0].offsetPx - hview.offsetPx
  const vbottom = vblocks[0].offsetPx - vview.offsetPx
  const theme = useTheme()
  const stroke = theme.palette.divider

  // Uses math.max/min avoid making very large SVG rect offscreen element,
  // which can sometimes fail to draw
  const rx = Math.max(hbottom, 0)
  const ry = Math.max(viewHeight - vtop, 0)
  const w = Math.min(htop - hbottom, viewWidth)
  const h = Math.min(viewHeight - vbottom - ry, viewHeight)

  let lastx = Infinity
  let lasty = Infinity
  return (
    <>
      <rect
        x={rx}
        y={ry}
        width={w}
        height={h}
        fill={theme.palette.background.default}
      />
      <g>
        {hblocks.map(region => {
          const x = region.offsetPx - hview.offsetPx
          const render = Math.floor(x) !== Math.floor(lastx)
          if (render) {
            lastx = x
          }
          return render ? (
            <line
              key={JSON.stringify(region)}
              x1={x}
              y1={0}
              x2={x}
              y2={viewHeight}
              stroke={stroke}
            />
          ) : null
        })}
        {vblocks.map(region => {
          const y = viewHeight - (region.offsetPx - vview.offsetPx)
          const render = Math.floor(y) !== Math.floor(lasty)
          if (render) {
            lasty = y
          }
          return render ? (
            <line
              key={JSON.stringify(region)}
              x1={0}
              y1={y}
              x2={viewWidth}
              y2={y}
              stroke={stroke}
            />
          ) : null
        })}
        <line x1={htop} y1={0} x2={htop} y2={viewHeight} stroke={stroke} />
        <line
          x1={0}
          y1={viewHeight - vtop}
          x2={viewWidth}
          y2={viewHeight - vtop}
          stroke={stroke}
        />
      </g>
      {children}
    </>
  )
})

export default function Grid({
  model,
  children,
}: {
  model: DotplotViewModel
  children?: React.ReactNode
}) {
  const { viewWidth, viewHeight } = model
  return (
    <svg
      width={viewWidth}
      height={viewHeight}
      style={{ background: 'rgba(0,0,0,0.12)' }}
    >
      <GridRaw model={model}>{children}</GridRaw>
    </svg>
  )
}
