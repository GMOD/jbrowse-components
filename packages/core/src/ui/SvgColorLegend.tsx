/* eslint-disable react-refresh/only-export-components -- geometry constants belong with this leaf SVG primitive; no component state to fast-refresh */
import { useId } from 'react'

import { svgSafeId } from '../svg/svgId.ts'
import { LegendSwatchGlyph } from './LegendSwatchGlyph.tsx'
import { measureLegendText } from './measureLegendText.ts'

import type { ColorLegendEntry, LegendSwatch } from './legendSpec.ts'

export type { ColorLegendEntry } from './legendSpec.ts'

const FONT_SIZE = 10
const SWATCH_LEFT = 2
const SWATCH_GAP = 2

// Row geometry, exported so callers sizing an outer container stay in lockstep
// with what this draws.
export const LEGEND_ROW_HEIGHT = 14
export const LEGEND_SWATCH = 10

const GRADIENT_BAR_WIDTH = 100
const GRADIENT_BAR_HEIGHT = 10
// the bar plus the row of domain labels under it
const GRADIENT_ROW_HEIGHT = GRADIENT_BAR_HEIGHT + 4 + LEGEND_ROW_HEIGHT

/**
 * Horizontal space the LGV export reserves beside the plot for a display whose
 * legend asked to sit off the plot (`LegendMixin.svgLegendWidth`): the widest
 * row this draws for a ramp, plus a margin either side.
 */
export const LEGEND_SVG_GUTTER_WIDTH = GRADIENT_BAR_WIDTH + 40

// A row's swatches, with the flat `color` shorthand read as the single
// square it has always drawn.
function entrySwatches(entry: ColorLegendEntry): LegendSwatch[] {
  return (
    entry.swatches ??
    (entry.color === undefined ? [] : [{ color: entry.color }])
  )
}

// A row keying a color, as opposed to a title or note over such rows.
function keysAColor(entry: ColorLegendEntry) {
  return entry.gradient !== undefined || entrySwatches(entry).length > 0
}

// A ramp row is the bar and its labels, captioned when the entry has a label.
function rowHeight(entry: ColorLegendEntry) {
  return entry.gradient
    ? GRADIENT_ROW_HEIGHT + (entry.label ? LEGEND_ROW_HEIGHT : 0)
    : LEGEND_ROW_HEIGHT
}

// The rows that fit `maxHeight`, leaving room for a "+N more" summary when
// they do not all fit. A heading the cut separated from every row under it is
// dropped with them.
function fitEntries(entries: ColorLegendEntry[], maxHeight: number) {
  let used = 0
  const shown: ColorLegendEntry[] = []
  for (const [idx, entry] of entries.entries()) {
    const rest = entries.length - idx - 1
    const reserve = rest > 0 ? LEGEND_ROW_HEIGHT : 0
    if (used + rowHeight(entry) + reserve > maxHeight && shown.length > 0) {
      break
    }
    used += rowHeight(entry)
    shown.push(entry)
  }
  while (
    shown.length > 1 &&
    shown.length < entries.length &&
    !keysAColor(shown.at(-1)!)
  ) {
    shown.pop()
  }
  return shown
}

function GradientRow({
  entry,
  width,
  gradientId,
}: {
  entry: ColorLegendEntry
  width: number
  gradientId: string
}) {
  const { stops, minLabel, maxLabel } = entry.gradient!
  const barTop = (entry.label ? LEGEND_ROW_HEIGHT : 0) + 2
  const labelY = barTop + GRADIENT_BAR_HEIGHT + 2 + FONT_SIZE
  return (
    <>
      <rect
        x={0}
        y={0}
        width={width}
        height={rowHeight(entry)}
        fill="rgba(255,255,255,0.95)"
      />
      {entry.label ? (
        <text x={SWATCH_LEFT} y={11} fontSize={FONT_SIZE} fill="black">
          {entry.label}
        </text>
      ) : null}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map(stop => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              style={{ stopColor: stop.color, stopOpacity: stop.opacity ?? 1 }}
            />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={SWATCH_LEFT}
        y={barTop}
        width={GRADIENT_BAR_WIDTH}
        height={GRADIENT_BAR_HEIGHT}
        fill={`url(#${gradientId})`}
        rx={2}
      />
      <text x={SWATCH_LEFT} y={labelY} fontSize={FONT_SIZE} fill="black">
        {minLabel}
      </text>
      <text
        x={SWATCH_LEFT + GRADIENT_BAR_WIDTH}
        y={labelY}
        fontSize={FONT_SIZE}
        fill="black"
        textAnchor="end"
      >
        {maxLabel}
      </text>
    </>
  )
}

// Shared SVG color key: one translucent row per entry — a swatch and a label,
// or a ramp bar with its domain ends — right-aligned within `canvasWidth`, or
// at `x` when the caller places it (the LGV export's legend gutter). A <g>, so
// an on-screen SVG overlay and the export share one renderer.
//
// `maxHeight` (the display height) caps the box: entries past what fits
// collapse into a trailing "+N more" summary row, so the legend never overflows
// its display — the full list stays reachable via the track menu.
export default function SvgColorLegend({
  entries,
  canvasWidth,
  x,
  maxHeight,
  testid,
  idPrefix,
}: {
  entries: ColorLegendEntry[]
  canvasWidth: number
  x?: number
  maxHeight?: number
  // What a gradient's `<linearGradient id>` is minted from. An export passes
  // the display's `svgNodeId`, so two exports of one unchanged view are the
  // same bytes; on screen the React id is unique and enough.
  idPrefix?: string
  // opt-in marker for tests/screenshot specs: the legend renders only once
  // color entries exist (i.e. real data has loaded and been binned), so it is a
  // data-gated ready signal — unlike canvasDrawn, which can flip on an
  // empty first paint
  testid?: string
}) {
  const reactId = useId()
  const legendId = idPrefix ?? reactId
  const shown =
    maxHeight === undefined ? entries : fitEntries(entries, maxHeight)
  const cutRows = entries.slice(shown.length).filter(keysAColor).length
  const overflowLabel = cutRows > 0 ? `+${cutRows} more` : undefined

  // Labels line up across rows, so the swatch column is sized by the row with
  // the most swatches — otherwise a two-box row shoves its own label out of the
  // column the others share. One box reproduces the original 16px inset.
  const swatchColumns = Math.max(1, ...shown.map(e => entrySwatches(e).length))
  const textLeft =
    SWATCH_LEFT + swatchColumns * (LEGEND_SWATCH + SWATCH_GAP) + 2

  let contentRight = 0
  for (const entry of shown) {
    contentRight = Math.max(
      contentRight,
      entry.gradient
        ? SWATCH_LEFT +
            Math.max(
              GRADIENT_BAR_WIDTH,
              measureLegendText(entry.label, FONT_SIZE),
            )
        : textLeft + measureLegendText(entry.label, FONT_SIZE),
    )
  }
  if (overflowLabel !== undefined) {
    contentRight = Math.max(
      contentRight,
      textLeft + measureLegendText(overflowLabel, FONT_SIZE),
    )
  }
  const totalWidth = contentRight + 6
  const left = x ?? Math.max(0, canvasWidth - totalWidth - 4)
  const rowTops: number[] = []
  let y = 0
  for (const entry of shown) {
    rowTops.push(y)
    y += rowHeight(entry)
  }
  return shown.length || overflowLabel ? (
    <g transform={`translate(${left} 0)`} data-testid={testid}>
      {shown.map((entry, idx) => (
        <g key={entry.key} transform={`translate(0 ${rowTops[idx]})`}>
          {entry.gradient ? (
            <GradientRow
              entry={entry}
              width={totalWidth}
              gradientId={svgSafeId(`${legendId}-${entry.key}`)}
            />
          ) : (
            <>
              <rect
                x={0}
                y={0}
                width={totalWidth}
                height={LEGEND_ROW_HEIGHT}
                fill="rgba(255,255,255,0.95)"
              />
              {/* only the swatch and label dim for a toggled-off entry — dimming
                  the row group would take the white paper with it, letting the
                  canvas bleed through and making the struck-out label harder to
                  read */}
              <g opacity={entry.hidden ? 0.35 : 1}>
                {entrySwatches(entry).map((swatch, i) => (
                  <LegendSwatchGlyph
                    key={`${swatch.shape}-${swatch.color}`}
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
            </>
          )}
        </g>
      ))}
      {overflowLabel === undefined ? null : (
        <g transform={`translate(0 ${y})`}>
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
    </g>
  ) : null
}
