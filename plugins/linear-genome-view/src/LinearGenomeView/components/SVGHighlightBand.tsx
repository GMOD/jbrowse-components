import { getFillProps } from '@jbrowse/core/util'

// One full-height SVG highlight band with an optional label at the top,
// mirroring the on-screen HighlightBand div: a label wider than its band runs
// past the band's right edge.
export default function SVGHighlightBand({
  coords,
  height,
  color,
  label,
  labelColor,
}: {
  coords: { left: number; width: number }
  height: number
  color: string
  label?: string
  labelColor: string
}) {
  return (
    <>
      <rect
        x={coords.left}
        y={0}
        width={coords.width}
        height={height}
        {...getFillProps(color)}
      />
      {label ? (
        <text
          x={coords.left + 3}
          y={2}
          fontSize={11}
          dominantBaseline="hanging"
          {...getFillProps(labelColor)}
        >
          {label}
        </text>
      ) : null}
    </>
  )
}
