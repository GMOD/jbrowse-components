import {
  LOOP_CASING_COLOR,
  LOOP_CASING_PX,
  bezierArcKey,
} from '../../features/linkedReads/computeOverlay.ts'
import {
  BEZIER_ARC_STROKE_OPACITY,
  computePileupBezierArcsFromModel,
} from './pileupBezierArcs.ts'

import type { ColorPalette } from '../renderers/AlignmentsRenderer.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

// Clips a section's connectors to its own pileup band, in the overlay's screen
// coordinates. A nested viewport rather than a clipPath, so neither the overlay
// nor the export has an id to mint.
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export function SectionBandClip({
  clipTop,
  clipBottom,
  width,
  children,
}: {
  clipTop: number
  clipBottom: number
  width: number
  children: React.ReactNode
}) {
  const clipHeight = Math.max(0, clipBottom - clipTop)
  return (
    <svg
      y={clipTop}
      width={width}
      height={clipHeight}
      viewBox={`0 ${clipTop} ${width} ${clipHeight}`}
    >
      {children}
    </svg>
  )
}

// Static linked-read bezier arcs for SVG export — same geometry as
// PileupBezierOverlay, minus the hover/click handlers, and at the same
// scrollTop: the arcs connect reads, so pinning them to 0 while the reads
// scrolled left them hanging off the wrong rows.
//
// Not an observer, for the reason `SashimiArcsSvg` states: the geometry is
// built from `view.offsetPx`/`bpPerPx`, so subscribing slid these arcs across
// a frozen figure's reads on every pan.
export default function PileupBezierArcsSvg({
  model,
  view,
  width,
  colors,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
  width: number
  colors: ColorPalette
}) {
  const sections = computePileupBezierArcsFromModel(model, view, colors)
  return sections.length ? (
    <g style={{ pointerEvents: 'none' }}>
      {sections.map(({ groupKey, clipTop, clipBottom, arcs }) => (
        <SectionBandClip
          key={groupKey}
          clipTop={clipTop}
          clipBottom={clipBottom}
          width={width}
        >
          {arcs.map(arc => (
            <g key={bezierArcKey(arc)}>
              {arc.cased ? (
                <path
                  d={arc.d}
                  stroke={LOOP_CASING_COLOR}
                  strokeWidth={arc.strokeWidth + 2 * LOOP_CASING_PX}
                  fill="none"
                />
              ) : null}
              <path
                d={arc.d}
                stroke={arc.stroke}
                strokeWidth={arc.strokeWidth}
                strokeOpacity={arc.cased ? 1 : BEZIER_ARC_STROKE_OPACITY}
                // Exported dashed too: a junction across unfetched segments
                // reads as a solid inversion in a figure exactly as on screen.
                strokeDasharray={arc.dash}
                fill="none"
              />
            </g>
          ))}
        </SectionBandClip>
      ))}
    </g>
  ) : null
}
