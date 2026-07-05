import { getFillProps, getStrokeProps, measureText } from '@jbrowse/core/util'
import { colorByShortLabel, getColorBySwatch } from '@jbrowse/synteny-core'
import { useTheme } from '@mui/material'

import type { SyntenyColorBy } from '@jbrowse/synteny-core'

const pad = 6
const titleSize = 11
const rowSize = 10
const rowH = 14
const swatchBox = 10
const gap = 4
const barW = 54

// SVG counterpart of the on-screen ColorByLegend: a bordered, translucent box
// floated at the top-right of the plot. Reads the same swatch spec the HTML
// legend and the renderer use, so colors and labels can't drift.
export function SVGColorByLegend({
  colorBy,
  viewWidth,
}: {
  colorBy: SyntenyColorBy
  viewWidth: number
}) {
  const theme = useTheme()
  const swatch = getColorBySwatch(colorBy, { drawsCigar: false })
  const title = colorByShortLabel[colorBy]
  const text = theme.palette.text.primary
  const gradientId = `colorby-ramp-${colorBy}`

  const rampRow =
    swatch?.kind === 'ramp'
      ? measureText(swatch.minLabel, rowSize) +
        gap +
        barW +
        gap +
        measureText(swatch.maxLabel, rowSize)
      : 0
  const chipRows =
    swatch?.kind === 'chips'
      ? Math.max(
          ...swatch.chips.map(
            c => swatchBox + gap + measureText(c.label, rowSize),
          ),
        )
      : 0
  const noteRow = swatch
    ? 0
    : measureText('Distinct color per sequence', rowSize)
  const bodyRows =
    swatch?.kind === 'chips' ? swatch.chips.length : swatch ? 1 : 1

  const contentW = Math.max(
    measureText(title, titleSize),
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
            x={pad + measureText(swatch.minLabel, rowSize) + gap}
            y={bodyTop + (rowH - swatchBox) / 2}
            width={barW}
            height={swatchBox}
            rx={2}
            fill={`url(#${gradientId})`}
            {...getStrokeProps(theme.palette.divider)}
          />
          <text
            x={pad + measureText(swatch.minLabel, rowSize) + gap + barW + gap}
            y={bodyTop + rowH / 2}
            fontSize={rowSize}
            dominantBaseline="middle"
            fill={text}
          >
            {swatch.maxLabel}
          </text>
        </>
      ) : null}

      {swatch?.kind === 'chips'
        ? swatch.chips.map((chip, i) => (
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
                {...getFillProps(chip.color)}
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
          Distinct color per sequence
        </text>
      )}
    </g>
  )
}
