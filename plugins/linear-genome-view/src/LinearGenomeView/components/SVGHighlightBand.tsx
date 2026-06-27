import { getFillProps } from '@jbrowse/core/util'

// One full-height SVG highlight band with an optional label at the top,
// mirroring the on-screen HighlightBand div. Shared by the LGV native-highlight
// export (SVGHighlights) and the grid-bookmark export (LGVHighlightSVG). The
// label is hidden on bands too narrow to fit it.
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
      {label && coords.width > 3 ? (
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
