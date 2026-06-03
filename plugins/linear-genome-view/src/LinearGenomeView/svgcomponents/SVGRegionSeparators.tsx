import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

// SVG component, region separator
export default function SVGRegionSeparators({
  model,
  height,
}: {
  height: number
  model: LGV
}) {
  const { dynamicBlocks, offsetPx } = model
  return (
    <>
      {dynamicBlocks.contentBlocks.slice(1).map(block => (
        <rect
          key={block.key}
          x={block.offsetPx - offsetPx - 1}
          width={3}
          y={0}
          height={height}
          fill="grey"
        />
      ))}
    </>
  )
}
