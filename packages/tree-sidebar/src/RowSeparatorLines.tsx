import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getStrokeProps } from '@jbrowse/core/util'

// Hairlines on the boundaries between stacked rows, for the row displays that
// draw a grid over their painting (multi-wiggle, the multi-row feature
// display). Lives here beside `SvgRowLabels` and `RowLabelsOverlay` because it
// is the same row geometry, and because the pixel rule below is the kind of
// thing that silently drifts when it is written down twice.
//
// Emits bare `<line>` fragments and takes the width to span explicitly, so the
// same component serves the live display (CSS-pixel track width) and the SVG
// export (view width) and the two can't diverge. Each caller keeps its own
// "should there be a grid at all" gate — a toggle, a rendering mode — and
// passes the opacity its painting needs: blocks that fill their row edge to
// edge swallow a fainter line than bars sitting on paper.
export function RowSeparatorLines({
  numRows,
  rowHeight,
  width,
  opacity,
  minRowPx = 0,
}: {
  numRows: number
  rowHeight: number
  width: number
  // Alpha applied to the theme's divider color.
  opacity: number
  // Row height below which the grid is dropped: a 1px line between rows that
  // are themselves a couple of pixels tall is half the picture. 0 (the default)
  // always draws.
  minRowPx?: number
}) {
  const palette = usePalette()
  if (numRows < 2 || rowHeight < minRowPx) {
    return null
  }
  return (
    <>
      {Array.from({ length: numRows - 1 }).map((_, idx) => {
        // The line has to cover the pixel the boundary falls in, which is
        // `floor(boundary)` — not `round(boundary)`, which is a pixel too low
        // for every boundary whose fractional part is >= 0.5. rowHeight is
        // fractional whenever a display auto-fits its rows into a height, so
        // the content either side of a boundary already shares, and blends
        // into, that one pixel; a line one pixel below it leaves the blend
        // showing as a stripe of the neighbouring row's color and reads as the
        // grid being out of step with the painting. Half-pixel offset so the
        // 1px stroke fills that pixel rather than straddling two.
        const y = Math.floor(rowHeight * (idx + 1)) + 0.5
        return (
          <line
            // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one separator per row boundary
            key={`sep-${idx}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            // getStrokeProps splits the alpha onto a separate stroke-opacity
            // attribute so it survives the SVG export, which strips rgba()
            // alpha. See CrossHatches.
            {...getStrokeProps(alpha(palette.divider, opacity))}
            strokeWidth={1}
          />
        )
      })}
    </>
  )
}
