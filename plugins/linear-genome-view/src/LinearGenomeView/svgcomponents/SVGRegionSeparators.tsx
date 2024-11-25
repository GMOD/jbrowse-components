import React from 'react'

// locals
import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

// SVG component, region separator
export default function SVGRegionSeparators({
  model,
  height,
}: {
  height: number
  model: LGV
}) {
  const { dynamicBlocks, offsetPx, interRegionPaddingWidth } = model
  return (
    <>
      {dynamicBlocks.contentBlocks.slice(1).map(block => (
        <rect
          key={block.key}
          x={block.offsetPx - offsetPx - interRegionPaddingWidth}
          width={interRegionPaddingWidth}
          y={0}
          height={height}
          fill="grey"
        />
      ))}
    </>
  )
}
