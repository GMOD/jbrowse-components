import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getFillProps, stripAlpha } from '@jbrowse/core/util'
import { SvgHaloText } from '@jbrowse/display-ui'

import { labelBaselineFromTop } from '../svgcomponents/util.ts'

const LABEL_FONT_SIZE = 11
const LABEL_TOP = 2

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
// do not draw in genomic coordinates. The label prints over the first track's
// own label, so it carries the paper halo an overlapping track label does.
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
  const palette = usePalette()
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
        <SvgHaloText
          x={coords.left + 3}
          y={labelBaselineFromTop(LABEL_TOP, LABEL_FONT_SIZE)}
          fontSize={LABEL_FONT_SIZE}
          fill={stripAlpha(labelColor)}
          halo={stripAlpha(palette.background.paper)}
          haloWidth={3}
        >
          {label}
        </SvgHaloText>
      ) : null}
    </>
  )
}
