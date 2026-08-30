import { Suspense, lazy, useCallback } from 'react'

import { useMouseTracking } from '@jbrowse/core/ui'
import { getStrokeProps } from '@jbrowse/core/util'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { hitTestArcs } from './arcHitTest.ts'
import { arcLabelBaselineY } from './arcLayout.ts'
import { arcMidX, arcPathD } from './arcShape.ts'
import { drawArcs } from './drawArcs.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LaidOutArc } from './arcLayout.ts'
import type { MouseState } from '@jbrowse/core/ui'

const ArcTooltip = lazy(() => import('../ArcTooltip.tsx'))

// Both arc displays' body: everything that differed between them is resolved
// into `model.laidOutArcs`, so what is left is one list and two ways of painting
// it — a canvas on screen, one `<path>` per arc in the export. See
// `plugins/arc/CLAUDE.md` for why the split is that way round.

const Arcs = observer(function Arcs({
  model,
  exportSVG,
}: {
  model: ArcDisplayModel
  exportSVG?: boolean
}) {
  const theme = useTheme()
  const { laidOutArcs, hoveredFeature, canvasWidth, height } = model
  // contrasts against the track background in either theme
  const hoverColor = theme.palette.text.primary
  // the size and family the `<text>` elements used to inherit through the
  // cascade, which a canvas does not
  const font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`

  const hitTest = useCallback(
    (state?: MouseState) => {
      model.setHoveredFeature(
        state &&
          hitTestArcs(state.x, state.y, laidOutArcs, canvasWidth)?.feature,
      )
    },
    [model, laidOutArcs, canvasWidth],
  )
  const { handleMouseMove, handleMouseLeave } = useMouseTracking(hitTest)

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      drawArcs(ctx, laidOutArcs, {
        hovered: hoveredFeature,
        hoverColor,
        viewWidth: canvasWidth,
        font,
      })
    },
    [laidOutArcs, hoveredFeature, hoverColor, canvasWidth, font],
  )

  if (exportSVG) {
    return <ArcsSvg arcs={laidOutArcs} />
  }
  return (
    <div
      data-testid="arcs"
      style={{
        position: 'relative',
        width: canvasWidth,
        height,
        cursor: hoveredFeature ? 'pointer' : undefined,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        // The hover the move handler already resolved, not a second hit test, so
        // a click cannot land on a different arc from the one it is drawn over.
        if (hoveredFeature) {
          model.selectFeature(hoveredFeature)
        }
      }}
    >
      <OverlayCanvas
        width={canvasWidth}
        height={height}
        draw={draw}
        data-testid="arcs-canvas"
      />
      {hoveredFeature ? (
        <Suspense fallback={null}>
          <ArcTooltip contents={captionFor(laidOutArcs, hoveredFeature)} />
        </Suspense>
      ) : null}
    </div>
  )
})

function captionFor(
  arcs: readonly LaidOutArc[],
  feature: NonNullable<ArcDisplayModel['hoveredFeature']>,
) {
  return arcs.find(a => a.feature === feature)?.caption
}

// No `<svg>` of its own — the export shell has already opened one, and a second
// would clip the arcs to a box inside the box they were laid out in. No cull
// either: the export captures the whole region.
function ArcsSvg({ arcs }: { arcs: readonly LaidOutArc[] }) {
  return arcs.map(arc => {
    const stroke = getStrokeProps(arc.selected ? 'red' : arc.color)
    return (
      <g key={arc.key}>
        <path
          {...stroke}
          d={arcPathD(arc.shape)}
          strokeWidth={arc.strokeWidth}
          fill="none"
        />
        {arc.ticks?.map(t => (
          <line
            key={`${t.x1}-${t.x2}`}
            {...stroke}
            strokeWidth={arc.strokeWidth}
            x1={t.x1}
            x2={t.x2}
            y1={t.y}
            y2={t.y}
          />
        ))}
        {arc.label ? <ArcLabel arc={arc} /> : null}
      </g>
    )
  })
}

// Two stacked `<text>`s, the white one first: SVG paints stroke over fill, so a
// thick white stroke under the real glyphs is the halo. `drawArcs` spells it
// strokeText-then-fillText.
function ArcLabel({ arc }: { arc: LaidOutArc }) {
  const x = arcMidX(arc.shape)
  const y = arcLabelBaselineY(arc)
  return (
    <>
      <text x={x} y={y} stroke="white" strokeWidth="0.6em">
        {arc.label}
      </text>
      <text x={x} y={y} stroke={arc.selected ? 'red' : 'black'}>
        {arc.label}
      </text>
    </>
  )
}

export default Arcs
