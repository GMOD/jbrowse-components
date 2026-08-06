import { useTheme } from '@mui/material'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

// SVG counterpart of the on-screen PaddingBlocks region separators: an opaque
// 3px bar at the right edge of every displayed region, in the same per-mode grey
// (a translucent fill would tint the track data it masks rather than hide it).
// Keyed off isRightEndOfDisplayedRegion like PaddingBlocks, so the bar at the
// last region's right edge isn't dropped.
//
// The seam is ALL of PaddingBlocks this draws, which is why it walks
// dynamicBlocks itself rather than reading `model.paddingSpans` like the
// on-screen component. The other two span kinds are chrome for an interactive
// row, not information a figure carries: `elided`'s striped grey says "regions
// here are too narrow to draw", which in a static image is noise, and at
// whole-genome zoom it is most of the row. Don't put this on paddingSpans to
// close the "divergence".
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
