import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { highlightBoxColors } from '@jbrowse/core/ui/hoverBoxStyle'
import { isFloatingLabelHost } from '@jbrowse/display-kit/floatingLabelHost'
import { isHighlightHost } from '@jbrowse/display-kit/highlightHost'
import { observer } from 'mobx-react'

import { onBottomHalf } from '../CircularView/rulerLabels.ts'
import {
  ringLabelArcPath,
  ringLabels,
  stripRectToSectorPath,
} from './ringPolar.ts'

import type { Ring } from './ringHost.ts'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { SVGProps } from 'react'

const Sectors = observer(function Sectors({
  ring,
  rects,
  stripRadiusPx,
  testid,
  ...paint
}: {
  ring: Ring
  rects: readonly HighlightRect[]
  stripRadiusPx: number
  testid: string
} & SVGProps<SVGPathElement>) {
  return rects.map(rect => {
    const d = stripRectToSectorPath(ring, rect, stripRadiusPx)
    return d ? (
      <path
        key={`${rect.left}-${rect.top}-${rect.width}-${rect.height}`}
        data-testid={testid}
        d={d}
        {...paint}
      />
    ) : null
  })
})

// a ring display's highlights as sectors of its band; the export draws the
// pinned ones alone, as a linear export does
const RingHighlights = observer(function RingHighlights({
  ring,
  stripRadiusPx,
  exporting,
}: {
  ring: Ring
  stripRadiusPx: number
  exporting: boolean
}) {
  const palette = usePalette()
  const { display } = ring
  if (!isHighlightHost(display)) {
    return null
  }
  const pinned = highlightBoxColors(palette.highlight.main)
  const sectors = { ring, stripRadiusPx }
  return (
    <>
      <Sectors
        {...sectors}
        rects={display.pinnedInk ?? []}
        testid="ring-pinned"
        fill={pinned.fill}
        stroke={pinned.border}
      />
      {exporting ? null : (
        <>
          <Sectors
            {...sectors}
            rects={display.selectionInk ?? []}
            testid="ring-selection"
            fill="none"
            stroke={palette.featureSelected}
            strokeWidth={2}
          />
          <Sectors
            {...sectors}
            rects={display.hoverInk}
            testid="ring-hover"
            fill={palette.featureHover}
          />
        </>
      )}
    </>
  )
})

// a ring display's labels, each curved along its arc; ids carry the view's
// and the display's so two circles on one page never share a path
const RingLabels = observer(function RingLabels({
  ring,
  stripRadiusPx,
  offsetRadians,
  idPrefix,
}: {
  ring: Ring
  stripRadiusPx: number
  offsetRadians: number
  idPrefix: string
}) {
  const palette = usePalette()
  const { display } = ring
  if (!isFloatingLabelHost(display)) {
    return null
  }
  return ringLabels(ring, display.floatingLabels(palette), stripRadiusPx).map(
    (label, i) => {
      const id = `${idPrefix}-${i}`
      return (
        <g key={label.key} data-testid="ring-label">
          <path
            id={id}
            d={ringLabelArcPath(
              label,
              onBottomHalf(label.radians, offsetRadians),
            )}
            fill="none"
          />
          <text
            fontSize={label.fontSize}
            fill={label.color}
            dominantBaseline="middle"
          >
            <textPath
              xlinkHref={`#${id}`}
              startOffset="50%"
              textAnchor="middle"
            >
              {label.text}
            </textPath>
          </text>
        </g>
      )
    },
  )
})

/**
 * What each ring display draws over its canvas rather than into it, which the
 * ring's resampling of the canvas never sees: its highlights, and its labels
 * at the ring's own size. In the figure's rotated frame, on screen and in the
 * export alike.
 */
export const RingOverlay = observer(function RingOverlay({
  model,
  exporting = false,
}: {
  model: {
    id: string
    offsetRadians: number
    ringHost: { rings: readonly Ring[]; stripRadiusPx: number }
  }
  exporting?: boolean
}) {
  const { ringHost, offsetRadians, id } = model
  const { stripRadiusPx } = ringHost
  return (
    <g data-testid="ring-overlay" pointerEvents="none">
      {ringHost.rings.map(ring => (
        <g key={ring.display.id}>
          <RingHighlights
            ring={ring}
            stripRadiusPx={stripRadiusPx}
            exporting={exporting}
          />
          <RingLabels
            ring={ring}
            stripRadiusPx={stripRadiusPx}
            offsetRadians={offsetRadians}
            idPrefix={`ring-label-${id}-${ring.display.id}`}
          />
        </g>
      ))}
    </g>
  )
})
