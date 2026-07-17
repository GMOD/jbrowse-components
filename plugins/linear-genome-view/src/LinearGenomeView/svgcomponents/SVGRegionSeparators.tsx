import { useTheme } from '@mui/material'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

// SVG counterpart of the on-screen PaddingBlocks region separators: an opaque
// 3px bar at the right edge of every displayed region, in the same per-mode grey
// (a translucent fill would tint the track data it masks rather than hide it).
// Keyed off isRightEndOfDisplayedRegion like PaddingBlocks, so the bar at the
// last region's right edge isn't dropped.
export default function SVGRegionSeparators({
  model,
  height,
}: {
  height: number
  model: LGV
}) {
  const { dynamicBlocks, offsetPx } = model
  const theme = useTheme()
  const fill =
    theme.palette.mode === 'dark'
      ? theme.palette.grey[500]
      : theme.palette.grey[600]
  return (
    <>
      {dynamicBlocks.contentBlocks
        .filter(block => block.isRightEndOfDisplayedRegion)
        .map(block => (
          <rect
            key={block.key}
            x={block.offsetPx + block.widthPx - offsetPx - 1}
            width={3}
            y={0}
            height={height}
            fill={fill}
          />
        ))}
    </>
  )
}
