import React from 'react'

import { YScaleBar } from '@jbrowse/wiggle-core'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Layout for the coverage/conservation Y-axis gutter. The left-oriented
// YScaleBar sits in a 50px-wide gutter translated 45px right (a 5px margin).
// Shared by the on-screen axes and SVG export so they can't drift.
const YSCALE_AXIS_WIDTH = 50
export const YSCALE_AXIS_X = 45

/**
 * A left-oriented Y-axis in the shared gutter, at a vertical band offset.
 * Every stacked MAF band (coverage at `top: 0`, conservation below it) draws
 * its axis through this, and `renderSvg` emits the same `<g>` transform, so the
 * on-screen and exported axes cannot drift apart.
 */
export default function MafYScaleGutter({
  top,
  height,
  ticks,
}: {
  top: number
  height: number
  ticks: YScaleTicks
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top,
        left: 0,
        pointerEvents: 'none',
        height,
        width: YSCALE_AXIS_WIDTH,
      }}
    >
      <SvgYScaleGutter y={0} ticks={ticks} />
    </svg>
  )
}

/**
 * The gutter's `<g>` on its own, for callers that already own an `<svg>` — the
 * SVG export, whose bands are positioned by the enclosing document.
 */
export function SvgYScaleGutter({
  y,
  ticks,
}: {
  y: number
  ticks: YScaleTicks
}) {
  return (
    <g transform={`translate(${YSCALE_AXIS_X}, ${y})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  )
}
