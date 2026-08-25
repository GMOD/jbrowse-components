/* eslint-disable react-refresh/only-export-components -- geometry constants belong with this leaf SVG primitive; no component state to fast-refresh */
import { LegendSwatchGlyph } from './LegendSwatchGlyph.tsx'
import { measureLegendText } from './measureLegendText.ts'

import type { ColorLegendEntry, LegendSwatch } from './legendSpec.ts'
import type { ReactNode } from 'react'

export type { ColorLegendEntry } from './legendSpec.ts'

const FONT_SIZE = 10
const SWATCH_LEFT = 2
const SWATCH_GAP = 2

// Row geometry, exported so callers positioning `children` (or sizing an outer
// container) stay in lockstep with what this draws.
export const LEGEND_ROW_HEIGHT = 14
export const LEGEND_SWATCH = 10

// narrow right-side gutter reserved for the small dismiss "×"
const DISMISS_GUTTER = 11

// A row's marks, with the flat `color` shorthand read as the single filled
// square it has always drawn.
function entrySwatches(entry: ColorLegendEntry): LegendSwatch[] {
  return (
    entry.swatches ??
    (entry.color === undefined ? [] : [{ color: entry.color }])
  )
}

// Shared SVG categorical color key: one translucent row per entry, each a swatch
// + label, right-aligned within canvasWidth. Used by any display that colors by
// a discrete vocabulary (wiggle multi-source overlays, multi-row per-feature
// paintings). A <g> so the on-screen overlay and the SVG export share one
// renderer.
//
// Two escape hatches keep it usable for less-uniform legends without a second
// component: a per-entry `marker` overrides the color square, and `children`
// render inside the positioned box below the rows (from the box's top-left; the
// rows occupy `shownEntryCount * LEGEND_ROW_HEIGHT`). Draws nothing when there's
// neither an entry nor a child.
//
// `maxHeight` (e.g. the display height) caps the box: entries past what fits
// collapse into a trailing "+N more" summary row, so the legend never overflows
// its display — the full list stays reachable via the track menu.
//
// `onDismiss` adds a clickable "×" in the top-right corner (with its own
// pointer-events so it works under a pointer-events:none overlay). Pass it only
// on interactive paths where the legend can be re-shown — never on the SVG
// export, which has no way to click it.
export default function SvgColorLegend({
  entries,
  canvasWidth,
  maxHeight,
  onDismiss,
  children,
  testid,
}: {
  entries: ColorLegendEntry[]
  canvasWidth: number
  maxHeight?: number
  onDismiss?: () => void
  children?: ReactNode
  // opt-in marker for tests/screenshot specs: the legend renders only once
  // color entries exist (i.e. real data has loaded and been binned), so it is a
  // data-gated ready signal — unlike canvasDrawn, which can flip on an
  // empty first paint
  testid?: string
}) {
  const fit =
    maxHeight === undefined
      ? entries.length
      : Math.max(1, Math.floor(maxHeight / LEGEND_ROW_HEIGHT))
  // reserve the last fitting row for the summary when truncating
  const shown = entries.length > fit ? entries.slice(0, fit - 1) : entries
  const overflowLabel =
    entries.length > fit ? `+${entries.length - shown.length} more` : undefined

  // Labels line up across rows, so the swatch column is sized by the row with
  // the most marks — otherwise a two-mark row shoves its own label out of the
  // column the others share. One mark reproduces the original 16px inset.
  const swatchColumns = Math.max(1, ...shown.map(e => entrySwatches(e).length))
  const textLeft =
    SWATCH_LEFT + swatchColumns * (LEGEND_SWATCH + SWATCH_GAP) + 2

  let maxLabelWidth = 0
  for (const entry of shown) {
    maxLabelWidth = Math.max(
      maxLabelWidth,
      measureLegendText(entry.label, FONT_SIZE),
    )
  }
  if (overflowLabel !== undefined) {
    maxLabelWidth = Math.max(
      maxLabelWidth,
      measureLegendText(overflowLabel, FONT_SIZE),
    )
  }
  const totalWidth =
    textLeft + maxLabelWidth + 6 + (onDismiss ? DISMISS_GUTTER : 0)
  const x = Math.max(0, canvasWidth - totalWidth - 4)
  return shown.length || overflowLabel || children ? (
    <g transform={`translate(${x} 0)`} data-testid={testid}>
      {shown.map((entry, idx) => (
        <g
          key={entry.key}
          transform={`translate(0 ${idx * LEGEND_ROW_HEIGHT})`}
        >
          <rect
            x={0}
            y={0}
            width={totalWidth}
            height={LEGEND_ROW_HEIGHT}
            fill="rgba(255,255,255,0.95)"
          />
          {/* only the swatch and label dim for a toggled-off entry — dimming the
              row group would take the white paper with it, letting the canvas
              bleed through and making the struck-out label harder to read */}
          <g opacity={entry.hidden ? 0.35 : 1}>
            {entry.marker ??
              entrySwatches(entry).map((swatch, i) => (
                <LegendSwatchGlyph
                  key={`${swatch.color}-${swatch.mark ?? 'fill'}`}
                  swatch={swatch}
                  size={LEGEND_SWATCH}
                  x={SWATCH_LEFT + i * (LEGEND_SWATCH + SWATCH_GAP)}
                  y={2}
                />
              ))}
            <text
              x={textLeft}
              y={11}
              fontSize={FONT_SIZE}
              fill="black"
              textDecoration={entry.hidden ? 'line-through' : undefined}
            >
              {entry.label}
            </text>
          </g>
        </g>
      ))}
      {overflowLabel === undefined ? null : (
        <g transform={`translate(0 ${shown.length * LEGEND_ROW_HEIGHT})`}>
          <rect
            x={0}
            y={0}
            width={totalWidth}
            height={LEGEND_ROW_HEIGHT}
            fill="rgba(255,255,255,0.95)"
          />
          <text x={textLeft} y={11} fontSize={FONT_SIZE} fill="#555">
            {overflowLabel}
          </text>
        </g>
      )}
      {onDismiss === undefined ? null : (
        <g
          transform={`translate(${totalWidth - DISMISS_GUTTER} 0)`}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          // The one part of this legend that takes pointer events, so it is the
          // one part that has to claim the press: without it a press on the "×"
          // that drifts a pixel pans the view under the legend. Only rendered on
          // the interactive path, so the exported SVG never carries it.
          data-gesture-owner="true"
          onClick={() => {
            onDismiss()
          }}
        >
          <title>Hide legend</title>
          {/* transparent hit target spanning the gutter */}
          <rect
            x={0}
            y={0}
            width={DISMISS_GUTTER}
            height={LEGEND_ROW_HEIGHT}
            fill="transparent"
          />
          <text
            x={DISMISS_GUTTER / 2}
            y={9}
            fontSize={9}
            fill="#777"
            textAnchor="middle"
          >
            ×
          </text>
        </g>
      )}
      {children}
    </g>
  ) : null
}
