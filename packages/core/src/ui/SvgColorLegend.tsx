/* eslint-disable react-refresh/only-export-components -- geometry constants belong with this leaf SVG primitive; no component state to fast-refresh */
import { useId } from 'react'

import { useExportFontFamily } from '../svg/constants.ts'
import { svgSafeId } from '../svg/svgId.ts'
import { LegendSwatchGlyph } from './LegendSwatchGlyph.tsx'
import { usePalette } from './PaletteContext.tsx'
import { legendSwatchColumns, legendSwatches } from './legendSpec.ts'
import { measureLegendText } from './measureLegendText.ts'
import { alpha } from './palette.ts'

import type { ColorLegendEntry } from './legendSpec.ts'

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

// The key's paper and inks, translucent over whatever the display drew
function useLegendInks() {
  const palette = usePalette()
  return {
    paper: alpha(palette.background.paper, 0.95),
    text: palette.text.primary,
    faint: palette.text.secondary,
  }
}

// A row keying a color, as opposed to a title or note over such rows.
function keysAColor(entry: ColorLegendEntry) {
  return entry.gradient !== undefined || legendSwatches(entry).length > 0
}

// A row with more swatches than the shared column draws them on a line of
// their own, over its label.
function stacks(entry: ColorLegendEntry, columns: number) {
  return legendSwatches(entry).length > columns
}

// A ramp row is the bar and its labels, captioned when the entry has a label.
function rowHeight(entry: ColorLegendEntry, columns: number) {
  return entry.gradient
    ? GRADIENT_ROW_HEIGHT + (entry.label ? LEGEND_ROW_HEIGHT : 0)
    : stacks(entry, columns)
      ? 2 * LEGEND_ROW_HEIGHT
      : LEGEND_ROW_HEIGHT
}

function swatchesWidth(count: number) {
  return count * (LEGEND_SWATCH + SWATCH_GAP)
}

// The rows that fit `maxHeight`, leaving room for a "+N more" summary when
// they do not all fit, and none when not even the first row and that summary
// fit: a key taller than its display runs into whatever is below it, or off the
// foot of the figure. A heading the cut separated from every row under it is
// dropped with them.
function fitEntries(
  entries: ColorLegendEntry[],
  maxHeight: number,
  columns: number,
) {
  let used = 0
  const shown: ColorLegendEntry[] = []
  for (const [idx, entry] of entries.entries()) {
    const rest = entries.length - idx - 1
    const reserve = rest > 0 ? LEGEND_ROW_HEIGHT : 0
    if (used + rowHeight(entry, columns) + reserve > maxHeight) {
      break
    }
    used += rowHeight(entry, columns)
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

// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
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
  const inks = useLegendInks()
  const barTop = (entry.label ? LEGEND_ROW_HEIGHT : 0) + 2
  const height = GRADIENT_ROW_HEIGHT + (entry.label ? LEGEND_ROW_HEIGHT : 0)
  const labelY = barTop + GRADIENT_BAR_HEIGHT + 2 + FONT_SIZE
  return (
    <>
      <rect x={0} y={0} width={width} height={height} fill={inks.paper} />
      {entry.label ? (
        <text x={SWATCH_LEFT} y={11} fontSize={FONT_SIZE} fill={inks.text}>
          {entry.label}
        </text>
      ) : null}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map(stop => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity ?? 1}
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
      <text x={SWATCH_LEFT} y={labelY} fontSize={FONT_SIZE} fill={inks.text}>
        {minLabel}
      </text>
      <text
        x={SWATCH_LEFT + GRADIENT_BAR_WIDTH}
        y={labelY}
        fontSize={FONT_SIZE}
        fill={inks.text}
        textAnchor="end"
      >
        {maxLabel}
      </text>
    </>
  )
}

// What the key draws for `entries` under `maxHeight`, and how wide its paper
// is, so a caller sizing a gutter measures the box this renders.
function legendBox(
  entries: ColorLegendEntry[],
  maxHeight?: number,
  fontFamily?: string,
) {
  const columns = legendSwatchColumns(entries)
  const shown =
    maxHeight === undefined ? entries : fitEntries(entries, maxHeight, columns)
  const cutRows = entries.slice(shown.length).filter(keysAColor).length
  const overflowLabel =
    cutRows > 0 && shown.length > 0 ? `+${cutRows} more` : undefined

  const textLeft = SWATCH_LEFT + swatchesWidth(columns) + 2

  let contentRight = 0
  for (const entry of shown) {
    contentRight = Math.max(
      contentRight,
      entry.gradient
        ? SWATCH_LEFT +
            Math.max(
              GRADIENT_BAR_WIDTH,
              measureLegendText(entry.label, FONT_SIZE, fontFamily),
            )
        : Math.max(
            textLeft + measureLegendText(entry.label, FONT_SIZE, fontFamily),
            SWATCH_LEFT + swatchesWidth(legendSwatches(entry).length),
          ),
    )
  }
  if (overflowLabel !== undefined) {
    contentRight = Math.max(
      contentRight,
      textLeft + measureLegendText(overflowLabel, FONT_SIZE, fontFamily),
    )
  }
  const totalWidth = contentRight + 6
  const rowTops: number[] = []
  let y = 0
  for (const entry of shown) {
    rowTops.push(y)
    y += rowHeight(entry, columns)
  }
  return {
    shown,
    columns,
    overflowLabel,
    textLeft,
    totalWidth,
    rowTops,
    bottom: y,
  }
}

/**
 * Width of the paper `SvgColorLegend` draws for `entries` under `maxHeight`, in
 * an export whose root carries `fontFamily`; 0 when it draws nothing.
 */
export function svgColorLegendWidth(
  entries: ColorLegendEntry[],
  maxHeight?: number,
  fontFamily?: string,
) {
  const { shown, totalWidth } = legendBox(entries, maxHeight, fontFamily)
  return shown.length ? totalWidth : 0
}

// Shared SVG color key: one translucent row per entry — a swatch and a label,
// or a ramp bar with its domain ends — right-aligned within `canvasWidth`, or
// at `x` when the caller places it (an export's legend gutter). A <g>, so
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
  const inks = useLegendInks()
  const fontFamily = useExportFontFamily()
  const legendId = idPrefix ?? reactId
  const {
    shown,
    columns,
    overflowLabel,
    textLeft,
    totalWidth,
    rowTops,
    bottom: y,
  } = legendBox(entries, maxHeight, fontFamily)
  const left = x ?? Math.max(0, canvasWidth - totalWidth - 4)
  return shown.length ? (
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
                height={rowHeight(entry, columns)}
                fill={inks.paper}
              />
              {/* only the swatch and label dim for a toggled-off entry — dimming
                  the row group would take the paper with it, letting the
                  canvas bleed through and making the struck-out label harder to
                  read */}
              <g opacity={entry.hidden ? 0.35 : 1}>
                {legendSwatches(entry).map((swatch, i) => (
                  <LegendSwatchGlyph
                    key={`${swatch.shape}-${swatch.color}`}
                    swatch={swatch}
                    size={LEGEND_SWATCH}
                    x={SWATCH_LEFT + swatchesWidth(i)}
                    y={2}
                  />
                ))}
                <text
                  x={textLeft}
                  y={(stacks(entry, columns) ? LEGEND_ROW_HEIGHT : 0) + 11}
                  fontSize={FONT_SIZE}
                  fill={inks.text}
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
            fill={inks.paper}
          />
          <text x={textLeft} y={11} fontSize={FONT_SIZE} fill={inks.faint}>
            {overflowLabel}
          </text>
        </g>
      )}
    </g>
  ) : null
}
