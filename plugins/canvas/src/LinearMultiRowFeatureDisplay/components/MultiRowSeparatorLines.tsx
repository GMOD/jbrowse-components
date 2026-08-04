import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getStrokeProps } from '@jbrowse/core/util'

import { MIN_SEPARATOR_ROW_PX } from '../rendering/rowBand.ts'

// Hairlines on the row boundaries, shared by the live display and the SVG
// export so the two can't drift. Both callers render this inside an <svg>, so it
// emits bare <line> fragments and takes the width to span explicitly (CSS-pixel
// track width on screen vs view width on export). Modeled on the multi-wiggle's
// MultiWiggleOverlayLines.
export default function MultiRowSeparatorLines({
  numRows,
  rowHeight,
  width,
}: {
  numRows: number
  rowHeight: number
  width: number
}) {
  const palette = usePalette()
  if (numRows < 2 || rowHeight < MIN_SEPARATOR_ROW_PX) {
    return null
  }
  return (
    <>
      {Array.from({ length: numRows - 1 }).map((_, idx) => {
        // +0.5 lands the 1px stroke on a device-pixel boundary so it renders
        // crisp instead of anti-aliased across the two rows it divides.
        const y = Math.round(rowHeight * (idx + 1)) + 0.5
        return (
          <line
            // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one separator per row boundary
            key={`sep-${idx}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            // blocks here are saturated fills edge to edge (rowProportion 1),
            // so the line is dialed further up than the wiggle's xyplot rows,
            // which sit on paper. getStrokeProps splits the alpha onto a
            // stroke-opacity attribute so it survives the SVG export, which
            // strips rgba() alpha.
            {...getStrokeProps(alpha(palette.divider, 0.4))}
            strokeWidth={1}
          />
        )
      })}
    </>
  )
}
