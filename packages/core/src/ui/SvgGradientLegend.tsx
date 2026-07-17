/* eslint-disable react-refresh/only-export-components -- layout constants belong with this leaf SVG primitive; no component state to fast-refresh */
export interface GradientStop {
  // e.g. '0%'; also used as the React key, so keep them distinct
  offset: string
  color: string
  // defaults to 1; alpha rides in stop-opacity (not baked into rgba) because
  // exporters support stop-color alpha unevenly
  opacity?: number
}

// A label pinned to the left end, center, or right end of the gradient bar.
export interface GradientLabel {
  text: string
  position: 'start' | 'middle' | 'end'
}

// Default box/bar geometry shared by the LD and Hi-C legends. Exported so
// callers that size an outer container (an <svg> wrapper) or compute an offset
// stay in lockstep with what this component draws.
export const GRADIENT_LEGEND_WIDTH = 120
export const GRADIENT_LEGEND_HEIGHT = 40

// Horizontal space a display should reserve (via `svgLegendWidth()`) to park
// this legend beside the plot in an SVG export: the bar itself plus a 10px
// margin either side.
export const GRADIENT_LEGEND_SVG_AREA_WIDTH = GRADIENT_LEGEND_WIDTH + 20

// Shared SVG color-ramp key: a rounded translucent box, a horizontal gradient
// bar, and labels below it. Used by any display that colors by a continuous
// scale (Hi-C contact counts, LD r²/D'). Renders a <g>; position via x/y.
export default function SvgGradientLegend({
  gradientId,
  stops,
  labels,
  title,
  x = 0,
  y = 0,
  width = GRADIENT_LEGEND_WIDTH,
  height = GRADIENT_LEGEND_HEIGHT,
  barWidth = 100,
  barHeight = 12,
  padding = 8,
  fontSize = 10,
}: {
  // must be document-unique when several gradient legends share one SVG
  gradientId: string
  stops: GradientStop[]
  labels: GradientLabel[]
  // optional caption drawn above the bar (e.g. "Contacts"); grows the box so
  // titleless callers (LD) keep their original geometry
  title?: string
  x?: number
  y?: number
  width?: number
  height?: number
  barWidth?: number
  barHeight?: number
  padding?: number
  fontSize?: number
}) {
  const titleGap = title ? fontSize + 4 : 0
  const barY = padding + titleGap
  const labelY = barY + barHeight + fontSize + 2
  return (
    <g transform={`translate(${x}, ${y})`}>
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
        x={0}
        y={0}
        width={width}
        height={height + titleGap}
        fill="rgba(255,255,255,0.9)"
        stroke="#ccc"
        strokeWidth={1}
        rx={4}
      />
      {title ? (
        <text
          x={padding}
          y={padding + fontSize}
          fontSize={fontSize}
          fill="black"
        >
          {title}
        </text>
      ) : null}
      <rect
        x={padding}
        y={barY}
        width={barWidth}
        height={barHeight}
        fill={`url(#${gradientId})`}
        rx={2}
      />
      {labels.map(label => (
        <text
          key={`${label.position}-${label.text}`}
          x={
            label.position === 'start'
              ? padding
              : label.position === 'middle'
                ? padding + barWidth / 2
                : padding + barWidth
          }
          y={labelY}
          fontSize={fontSize}
          fill="black"
          textAnchor={label.position === 'start' ? undefined : label.position}
        >
          {label.text}
        </text>
      ))}
    </g>
  )
}
