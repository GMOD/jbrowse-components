import React from 'react'
import { observer } from 'mobx-react'

// locals
import { DotplotViewModel } from '../model'

function Grid({
  model,
  children,
  stroke = '#0003',
}: {
  model: DotplotViewModel
  children: React.ReactNode
  stroke?: string
}) {
  const { viewWidth, viewHeight, hview, vview } = model
  const hblocks = hview.dynamicBlocks.contentBlocks
  const vblocks = vview.dynamicBlocks.contentBlocks
  const htop = hview.displayedRegionsTotalPx - hview.offsetPx
  const vtop = vview.displayedRegionsTotalPx - vview.offsetPx
  const hbottom = hblocks[0]?.offsetPx - hview.offsetPx
  const vbottom = vblocks[0]?.offsetPx - vview.offsetPx

  return (
    <svg
      style={{ background: 'rgba(0,0,0,0.12)' }}
      width={viewWidth}
      height={viewHeight}
    >
      <rect
        x={hbottom}
        y={viewHeight - vtop}
        width={htop - hbottom}
        height={vtop - vbottom}
        fill="#fff"
      />
      <g>
        {hblocks.map(region => {
          const x = region.offsetPx - hview.offsetPx
          return (
            <line
              key={JSON.stringify(region)}
              x1={x}
              y1={0}
              x2={x}
              y2={viewHeight}
              stroke={stroke}
            />
          )
        })}
        {vblocks.map(region => {
          const y = viewHeight - (region.offsetPx - vview.offsetPx)
          return (
            <line
              key={JSON.stringify(region)}
              x1={0}
              y1={y}
              x2={viewWidth}
              y2={y}
              stroke={stroke}
            />
          )
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
    </svg>
  )
}
export default observer(Grid)
