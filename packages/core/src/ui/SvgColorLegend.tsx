/* eslint-disable react-refresh/only-export-components -- geometry constants belong with this leaf SVG primitive; no component state to fast-refresh */
import type { ReactNode } from 'react'

import { measureText } from '../util/index.ts'

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

// Shared SVG categorical color key: one translucent row per entry, each a swatch
// + label, right-aligned within canvasWidth. Used by any display that colors by
// a discrete vocabulary (wiggle multi-source overlays, multi-row per-feature
// paintings). A <g> so the on-screen overlay and the SVG export share one
// renderer.
//
// Two escape hatches keep it usable for less-uniform legends without a second
// component: a per-entry `marker` overrides the color square, and `children`
// render inside the positioned box below the rows (from the box's top-left; the
// rows occupy `entries.length * LEGEND_ROW_HEIGHT`). Draws nothing when there's
// neither an entry nor a child.
export default function SvgColorLegend({
  entries,
  canvasWidth,
  children,
}: {
  entries: ColorLegendEntry[]
  canvasWidth: number
  children?: ReactNode
}) {
  let maxLabelWidth = 0
  for (const e of entries) {
    const w = measureText(e.label, FONT_SIZE) * APP_FONT_WIDTH_RATIO
    if (w > maxLabelWidth) {
      maxLabelWidth = w
    }
  }
  const totalWidth = TEXT_LEFT + maxLabelWidth + 6
  const x = Math.max(0, canvasWidth - totalWidth - 4)
  return entries.length || children ? (
    <g transform={`translate(${x} 0)`}>
      {entries.map((entry, idx) => (
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
      {children}
    </g>
  ) : null
}
