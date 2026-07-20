/* eslint-disable react-refresh/only-export-components -- geometry constants belong with this leaf SVG primitive; no component state to fast-refresh */
import { measureText } from '../util/index.ts'

import type { ReactNode } from 'react'

export interface ColorLegendEntry {
  // React key; keep distinct across entries
  key: string
  label: string
  // CSS color for the default square swatch; omit when supplying `marker`
  color?: string
  // toggled-off entries render dimmed and struck through
  hidden?: boolean
  // custom SVG drawn in the swatch slot instead of the default color square, in
  // row-local coords (the swatch occupies ~x:2 y:2, LEGEND_SWATCH square). Lets a
  // row key by line style, shape, gradient, etc. rather than a flat color.
  marker?: ReactNode
}

// measureText uses a Helvetica width table, but these <text> nodes have no
// font-family and render in the wider app font (Roboto), so pad the estimate
// before sizing the paper behind a label or it clips.
const APP_FONT_WIDTH_RATIO = 1.1
const FONT_SIZE = 10
const TEXT_LEFT = 16

// Row geometry, exported so callers positioning `children` (or sizing an outer
// container) stay in lockstep with what this draws.
export const LEGEND_ROW_HEIGHT = 14
export const LEGEND_SWATCH = 10

// narrow right-side gutter reserved for the small dismiss "×"
const DISMISS_GUTTER = 11

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

  let maxLabelWidth = 0
  for (const label of overflowLabel === undefined
    ? shown.map(e => e.label)
    : [...shown.map(e => e.label), overflowLabel]) {
    const w = measureText(label, FONT_SIZE) * APP_FONT_WIDTH_RATIO
    if (w > maxLabelWidth) {
      maxLabelWidth = w
    }
  }
  const totalWidth =
    TEXT_LEFT + maxLabelWidth + 6 + (onDismiss ? DISMISS_GUTTER : 0)
  const x = Math.max(0, canvasWidth - totalWidth - 4)
  return shown.length || overflowLabel || children ? (
    <g transform={`translate(${x} 0)`} data-testid={testid}>
      {shown.map((entry, idx) => (
        <g
          key={entry.key}
          transform={`translate(0 ${idx * LEGEND_ROW_HEIGHT})`}
          opacity={entry.hidden ? 0.35 : 1}
        >
          <rect
            x={0}
            y={0}
            width={totalWidth}
            height={LEGEND_ROW_HEIGHT}
            fill="rgba(255,255,255,0.8)"
          />
          {entry.marker ??
            (entry.color === undefined ? null : (
              <rect
                x={2}
                y={2}
                width={LEGEND_SWATCH}
                height={LEGEND_SWATCH}
                fill={entry.color}
              />
            ))}
          <text
            x={TEXT_LEFT}
            y={11}
            fontSize={FONT_SIZE}
            fill="black"
            textDecoration={entry.hidden ? 'line-through' : undefined}
          >
            {entry.label}
          </text>
        </g>
      ))}
      {overflowLabel === undefined ? null : (
        <g transform={`translate(0 ${shown.length * LEGEND_ROW_HEIGHT})`}>
          <rect
            x={0}
            y={0}
            width={totalWidth}
            height={LEGEND_ROW_HEIGHT}
            fill="rgba(255,255,255,0.8)"
          />
          <text x={TEXT_LEFT} y={11} fontSize={FONT_SIZE} fill="#555">
            {overflowLabel}
          </text>
        </g>
      )}
      {onDismiss === undefined ? null : (
        <g
          transform={`translate(${totalWidth - DISMISS_GUTTER} 0)`}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
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
