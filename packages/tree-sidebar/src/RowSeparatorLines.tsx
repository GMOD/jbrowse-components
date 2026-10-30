import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getStrokeProps } from '@jbrowse/core/util'
import { snappedRowTopPx } from '@jbrowse/render-core/shaders/rowSnap'
import { observer } from 'mobx-react'

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
 * Smallest row height a separator is drawn at.
 *
 * A 1px line between rows that are themselves 2px tall is half the picture, and
 * every display here lets its rows go below a pixel (a clustered cohort at 0.32
 * px a row is the case they exist for) — at that density the grid stops
 * dividing the plot and becomes it. Multi-wiggle drew the wash for exactly that
 * reason: it took the default, and the default was 0.
 *
 * Not a per-caller argument because the threshold is the pixel rule this
 * component already owns. Exported so a menu row can say why the grid is absent
 * (see the "Row separators" toggle).
 */
export const MIN_SEPARATOR_ROW_PX = 4

/** The divider color's alpha over blocks filling their rows edge to edge. */
export const FILLED_ROW_SEPARATOR_OPACITY = 0.4

interface SeparatorGeometry {
  numRows: number
  rowHeight: number
  // For a display whose rows scroll inside a viewport: the separators are
  // placed in viewport coordinates, and the ones outside it are skipped rather
  // than emitted — a 3,000-sample cohort at a fixed row height is 3,000 of
  // them otherwise, of which a screenful is visible.
  scrollTop?: number
  viewportHeight?: number
  // For a display whose rows snap to the device grid (`rowSnap.slang`): the
  // backing-store scale they snapped to. Each separator then fills the whole
  // device pixels just below its row's snapped top.
  dpr?: number
}

/** Each separator's top edge and thickness, in the rows' CSS px. */
function separatorBands({
  numRows,
  rowHeight,
  scrollTop = 0,
  viewportHeight,
  dpr,
}: SeparatorGeometry) {
  const bands: { idx: number; top: number; height: number }[] = []
  if (numRows < 2 || rowHeight < MIN_SEPARATOR_ROW_PX) {
    return bands
  }
  const height = dpr === undefined ? 1 : Math.max(1, Math.round(dpr)) / dpr
  for (let idx = 0; idx < numRows - 1; idx++) {
    // Unsnapped, the line has to cover the pixel the boundary falls in, which
    // is `floor(boundary)` — not `round(boundary)`, which is a pixel too low
    // for every boundary whose fractional part is >= 0.5. rowHeight is
    // fractional whenever a display auto-fits its rows into a height, so the
    // content either side of a boundary already shares, and blends into, that
    // one pixel; a line one pixel below it leaves the blend showing as a
    // stripe of the neighbouring row's color and reads as the grid being out
    // of step with the painting.
    const top =
      dpr === undefined
        ? Math.floor(rowHeight * (idx + 1)) - scrollTop
        : snappedRowTopPx(idx + 1, rowHeight, scrollTop, dpr)
    const mid = top + height / 2
    if (mid >= 0 && (viewportHeight === undefined || mid <= viewportHeight)) {
      bands.push({ idx, top, height })
    }
  }
  return bands
}

// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export function RowSeparatorLines({
  width,
  opacity,
  ...geometry
}: SeparatorGeometry & {
  width: number
  // Alpha applied to the theme's divider color.
  opacity: number
}) {
  const palette = usePalette()
  return (
    <>
      {separatorBands(geometry).map(({ idx, top, height }) => (
        <line
          key={`sep-${idx}`}
          x1={0}
          y1={top + height / 2}
          x2={width}
          y2={top + height / 2}
          // getStrokeProps splits the alpha onto a separate stroke-opacity
          // attribute so it survives the SVG export, which strips rgba()
          // alpha. See CrossHatches.
          {...getStrokeProps(alpha(palette.divider, opacity))}
          strokeWidth={height}
        />
      ))}
    </>
  )
}

/**
 * The on-screen separators as HTML boxes, for rows on the device grid. The
 * browser snaps a box to device pixels as it snaps the canvas beside it, but
 * leaves SVG content where it falls: on a page that puts the display at a
 * fractional device offset, an SVG line lands part-way into a row.
 */
export const RowSeparatorBoxes = observer(function RowSeparatorBoxes({
  width,
  opacity,
  ...geometry
}: SeparatorGeometry & {
  width: number
  opacity: number
}) {
  const palette = usePalette()
  const background = alpha(palette.divider, opacity)
  return (
    <>
      {separatorBands(geometry).map(({ idx, top, height }) => (
        <div
          key={`sep-${idx}`}
          style={{
            position: 'absolute',
            left: 0,
            top,
            width,
            height,
            background,
          }}
        />
      ))}
    </>
  )
})
