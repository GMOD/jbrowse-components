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

// Both arc displays' body, and both of their export bodies. Everything that
// differed between them — which features an arc joins, what it is coloured,
// whether it carries a label or a pair of direction ticks — is resolved into
// `model.laidOutArcs` by each display's own model, so what is left is one list
// and two ways of painting it.
//
// **On screen that is a canvas, and the hover is a hit test.** It used to be one
// `<path>` per arc with `pointer-events: stroke`, which made clicking free and
// made every other frame expensive: each arc was its own `observer` reading
// `view.bpToPx` and `view.offsetPx`, so a zoom ran a MobX reaction and patched
// ~3 SVG attributes PER ARC PER FRAME. Four arcs booked 12 DOM mutations a
// frame; a real SV callset carries thousands in view. The reason SVG was chosen
// — that hit-testing a curve on canvas is hard — stopped being true when the
// alignments read-connection band shipped `hitTestArcBand`, whose ranking this
// shares (`bestArcMark`).
//
// **The EXPORT is still one `<path>` per arc**, off the same list. That path
// runs once per export rather than once per frame, a figure wants vector, and
// the two cannot drift because neither places an arc — `LaidOutArc` does.

const Arcs = observer(function Arcs({
  model,
  exportSVG,
}: {
  model: ArcDisplayModel
  exportSVG?: boolean
}) {
  const theme = useTheme()
  const { laidOutArcs, hoveredFeature, canvasWidth, height } = model
  // The color a hovered arc takes: contrasts against the track background in
  // either theme, and resolved once here rather than per arc.
  const hoverColor = theme.palette.text.primary
  // A canvas inherits no font, and the `<text>` elements this replaced inherited
  // the app's through the cascade — so the theme's own body size and family are
  // what keeps a label the size it was.
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
        // The hover the move handler already resolved, not a second hit test:
        // one measurement, so a click cannot land on a different arc from the
        // one the cursor is drawn over. With nothing under the cursor there is
        // nothing to select, which is what an SVG stroke miss did too.
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

// The export's arcs. No `<svg>` of its own — the export shell has already opened
// one (renderDisplaySvg → SvgChrome → renderArcSvg's SvgClipRect), and a second
// would nest and clip the arcs to a box inside the box they were laid out in.
// No cull either: the export captures the whole region.
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
// thick white stroke under the real glyphs is the halo. `drawArcs` spells the
// same thing as strokeText-then-fillText.
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
