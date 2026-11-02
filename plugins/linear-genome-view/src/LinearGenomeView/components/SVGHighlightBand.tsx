import { getFillProps } from '@jbrowse/core/util'

export interface BandGap {
  top: number
  height: number
}

// The stretches of a band `height` tall left once the sorted, disjoint `gaps`
// are cut out of it.
export function spansAround(gaps: BandGap[], height: number) {
  const edges = [0, ...gaps.flatMap(g => [g.top, g.top + g.height]), height]
  return edges.flatMap((top, i) => {
    const bottom = edges[i + 1]
    return i % 2 === 0 && bottom !== undefined && bottom > top
      ? [{ top, height: bottom - top }]
      : []
  })
}

// One full-height SVG highlight band with an optional label at the top,
// mirroring the on-screen HighlightBand div: a label wider than its band runs
// past the band's right edge, and the band leaves out `gaps`, the tracks that
// do not draw in genomic coordinates.
export default function SVGHighlightBand({
  coords,
  height,
  gaps,
  color,
  label,
  labelColor,
}: {
  coords: { left: number; width: number }
  height: number
  gaps: BandGap[]
  color: string
  label?: string
  labelColor: string
}) {
  return (
    <>
      {spansAround(gaps, height).map(span => (
        <rect
          key={span.top}
          x={coords.left}
          y={span.top}
          width={coords.width}
          height={span.height}
          {...getFillProps(color)}
        />
      ))}
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
