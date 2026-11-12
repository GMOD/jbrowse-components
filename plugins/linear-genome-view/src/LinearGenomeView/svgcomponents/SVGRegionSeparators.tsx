import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import { viewportSeams } from './util.ts'

import type { LgvSvgChromeView } from './util.ts'

// SVG counterpart of the on-screen PaddingBlocks region separators: an opaque
// bar at the right edge of every displayed region, in the same per-mode grey
// (a translucent fill would tint the track data it masks rather than hide it).
//
// The seam is ALL of PaddingBlocks this draws. The other two span kinds are
// chrome for an interactive row, not information a figure carries: `elided`'s
// striped grey says "regions here are too narrow to draw", which in a static
// image is noise, and at whole-genome zoom it is most of the row.
export default function SVGRegionSeparators({
  model,
  height,
}: {
  height: number
  model: LgvSvgChromeView
}) {
  const fill = usePalette().regionSeparator
  return (
    <>
      {viewportSeams(model).map(({ key, x, width }) => (
        <rect key={key} x={x} width={width} y={0} height={height} fill={fill} />
      ))}
    </>
  )
}
