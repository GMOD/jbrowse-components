import { measureLegendText } from '@jbrowse/core/ui'
import { getFillProps, getStrokeProps, stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import {
  colorByFallbackNote,
  colorByShortLabel,
  getColorBySwatch,
} from './colorLegend.ts'
import { legendChipColor } from './colorUtils.ts'

import type { CigarOpMask, ColorChip } from './colorLegend.ts'
import type { SyntenyColorBy } from './colorUtils.ts'

const pad = 6
const titleSize = 11
const rowSize = 10
const rowH = 14
const swatchBox = 10
const gap = 4
const barW = 54
// keeps a long track name from turning the exported key into a very wide box
const maxLabelChars = 28

// SVG <text> has no ellipsis, and the box sizes itself to its widest row, so a
// long track name has to be cut here or the exported key grows without bound.
function elide(label: string) {
  return label.length > maxLabelChars
    ? `${label.slice(0, maxLabelChars - 1)}…`
    : label
}

// SVG counterpart of the on-screen ColorByLegend: a bordered, translucent box
// floated at the top-right of the plot. Reads the same swatch spec the HTML
// legend and the renderer use, so colors and labels can't drift.
//
// Widths come from measureLegendText, not measureText: these <text> nodes set no
// font-family and so render in the wider app font, and the raw Helvetica
// estimate under-measured them enough that a long chip label ran out past the
// box border.
export function SVGColorByLegend({
  colorBy,
  viewWidth,
  alpha = 1,
  pointBased = false,
  cigarOps,
  trackChips,
}: {
  // undefined when overlaid tracks are on different modes; the legend then
  // titles itself "Mixed" and lists the tracks rather than naming one mode
  colorBy: SyntenyColorBy | undefined
  viewWidth: number
  // the display's alpha — chips are blended over white by it, matching what the
  // HTML legend does, so the exported key reads like the exported plot
  alpha?: number
  // dotplot draws flat points, never CIGAR ops
  pointBased?: boolean
  // bitmask of indel ops actually drawn, as the ribbon legend passes on screen
  cigarOps?: CigarOpMask
  // one chip per overlaid track, for colorBy:'track' — the view supplies these
  trackChips?: ColorChip[]
}) {
  const theme = useTheme()
  const swatch =
    colorBy === undefined
      ? ({ kind: 'chips', chips: trackChips ?? [] } as const)
      : getColorBySwatch(colorBy, { pointBased, cigarOps, trackChips })
  const note = colorBy === undefined ? '' : colorByFallbackNote(colorBy)
  const title = colorBy === undefined ? 'Mixed' : colorByShortLabel[colorBy]
  const text = stripAlpha(theme.palette.text.primary)
  const gradientId = `colorby-ramp-${colorBy ?? 'mixed'}`

  const rampRow =
    swatch?.kind === 'ramp'
      ? measureLegendText(swatch.minLabel, rowSize) +
        gap +
        barW +
        gap +
        measureLegendText(swatch.maxLabel, rowSize)
      : 0
  const chips =
    swatch?.kind === 'chips'
      ? swatch.chips.map(c => ({ ...c, label: elide(c.label) }))
      : undefined
  const chipRows = chips
    ? Math.max(
        ...chips.map(
          c => swatchBox + gap + measureLegendText(c.label, rowSize),
        ),
      )
    : 0
  const noteRow = swatch ? 0 : measureLegendText(note, rowSize)
  const bodyRows = chips ? chips.length : 1

  const contentW = Math.max(
    measureLegendText(title, titleSize),
    rampRow,
    chipRows,
    noteRow,
  )
  const boxW = Math.ceil(contentW + pad * 2)
  const boxH = pad + rowH + bodyRows * rowH + pad
  const x = Math.max(viewWidth - boxW - 4, 4)
  const bodyTop = pad + rowH

  return (
    <g transform={`translate(${x} 4)`}>
      <rect
        width={boxW}
        height={boxH}
        rx={4}
        {...getFillProps(theme.palette.background.paper)}
        {...getStrokeProps(theme.palette.divider)}
      />
      <text
        x={pad}
        y={pad}
        fontSize={titleSize}
        fontWeight={600}
        dominantBaseline="hanging"
        fill={text}
      >
        {title}
      </text>

      {swatch?.kind === 'ramp' ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              {swatch.stops.map(s => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>
          <text
            x={pad}
            y={bodyTop + rowH / 2}
            fontSize={rowSize}
            dominantBaseline="middle"
            fill={text}
          >
            {swatch.minLabel}
          </text>
          <rect
            x={pad + measureLegendText(swatch.minLabel, rowSize) + gap}
            y={bodyTop + (rowH - swatchBox) / 2}
            width={barW}
            height={swatchBox}
            rx={2}
            fill={`url(#${gradientId})`}
            {...getStrokeProps(theme.palette.divider)}
          />
          <text
            x={
              pad +
              measureLegendText(swatch.minLabel, rowSize) +
              gap +
              barW +
              gap
            }
            y={bodyTop + rowH / 2}
            fontSize={rowSize}
            dominantBaseline="middle"
            fill={text}
          >
            {swatch.maxLabel}
          </text>
        </>
      ) : null}

      {chips
        ? chips.map((chip, i) => (
            <g
              key={chip.label}
              transform={`translate(0 ${bodyTop + i * rowH})`}
            >
              <rect
                x={pad}
                y={(rowH - swatchBox) / 2}
                width={swatchBox}
                height={swatchBox}
                rx={2}
                {...getFillProps(
                  chip.color === undefined
                    ? 'none'
                    : legendChipColor(chip.color, alpha),
                )}
                {...getStrokeProps(theme.palette.divider)}
              />
              <text
                x={pad + swatchBox + gap}
                y={rowH / 2}
                fontSize={rowSize}
                dominantBaseline="middle"
                fill={text}
              >
                {chip.label}
              </text>
            </g>
          ))
        : null}

      {swatch ? null : (
        <text
          x={pad}
          y={bodyTop + rowH / 2}
          fontSize={rowSize}
          dominantBaseline="middle"
          fill={text}
        >
          {note}
        </text>
      )}
    </g>
  )
}
