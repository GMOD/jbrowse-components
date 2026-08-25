import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getStrokeProps } from '@jbrowse/core/util'

// Hairlines on the boundaries between stacked rows, for the row displays that
// draw a grid over their painting (multi-wiggle, the multi-row feature
// display, the multi-sample variant displays). Lives here beside `SvgRowLabels`
// and `RowLabelsOverlay` because it is the same row geometry, and because the
// pixel rule below is the kind of thing that silently drifts when it is written
// down twice.
//
// Emits bare `<line>` fragments and takes the width to span explicitly, so the
// same component serves the live display (CSS-pixel track width) and the SVG
// export (view width) and the two can't diverge. Each caller keeps its own
// "should there be a grid at all" gate — a toggle, a rendering mode — and
// passes the opacity its painting needs: blocks that fill their row edge to
// edge swallow a fainter line than bars sitting on paper.

/**
 * Smallest row height a separator is drawn at, and the default `minRowPx`
 * below.
 *
 * A 1px line between rows that are themselves 2px tall is half the picture, and
 * every display here lets its rows go below a pixel (a clustered cohort at 0.32
 * px a row is the case they exist for) — at that density the grid stops
 * dividing the plot and becomes it. Multi-wiggle drew the wash for exactly that
 * reason: it took the default, and the default was 0.
 *
 * A default rather than a per-caller argument because the threshold is the
 * pixel rule this component already owns, and the one caller that passed it
 * spelled it in its own module while the other passed nothing. Read it for a
 * menu row that has to say why the grid is absent (see the "Show row
 * separators" toggle); pass `minRowPx` only for a display whose rows are
 * bounded some other way.
 */
export const MIN_SEPARATOR_ROW_PX = 4

export function RowSeparatorLines({
  numRows,
  rowHeight,
  width,
  opacity,
  minRowPx = MIN_SEPARATOR_ROW_PX,
  scrollTop = 0,
  viewportHeight,
}: {
  numRows: number
  rowHeight: number
  width: number
  // Alpha applied to the theme's divider color.
  opacity: number
  // Row height below which the grid is dropped; defaults to
  // MIN_SEPARATOR_ROW_PX. Pass 0 to always draw.
  minRowPx?: number
  // For a display whose rows scroll inside a viewport: the lines are drawn in
  // viewport coordinates, and the ones outside it are skipped rather than
  // emitted — a 3,000-sample cohort at a fixed row height is 3,000 `<line>`s
  // otherwise, of which a screenful is visible.
  scrollTop?: number
  viewportHeight?: number
}) {
  const palette = usePalette()
  if (numRows < 2 || rowHeight < minRowPx) {
    return null
  }
  const lines = []
  for (let idx = 0; idx < numRows - 1; idx++) {
    // The line has to cover the pixel the boundary falls in, which is
    // `floor(boundary)` — not `round(boundary)`, which is a pixel too low
    // for every boundary whose fractional part is >= 0.5. rowHeight is
    // fractional whenever a display auto-fits its rows into a height, so
    // the content either side of a boundary already shares, and blends
    // into, that one pixel; a line one pixel below it leaves the blend
    // showing as a stripe of the neighbouring row's color and reads as the
    // grid being out of step with the painting. Half-pixel offset so the
    // 1px stroke fills that pixel rather than straddling two.
    const y = Math.floor(rowHeight * (idx + 1)) + 0.5 - scrollTop
    if (y < 0 || (viewportHeight !== undefined && y > viewportHeight)) {
      continue
    }
    lines.push(
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
      />,
    )
  }
  return <>{lines}</>
}
