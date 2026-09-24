import { Suspense, lazy, useCallback } from 'react'

import { useMouseTracking } from '@jbrowse/core/ui'
import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { getStrokeProps } from '@jbrowse/core/util'
import { SvgHaloText } from '@jbrowse/display-ui'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { hitTestArcs } from './arcHitTest.ts'
import { arcLabelBaselineY } from './arcLayout.ts'
import { arcMidX, arcPathD } from './arcShape.ts'
import { LABEL_HALO_EM, drawArcs } from './drawArcs.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LaidOutArc } from './arcLayout.ts'
import type { MouseState } from '@jbrowse/core/ui'

const ArcTooltip = lazy(() => import('../ArcTooltip.tsx'))

// Both arc displays' body: everything that differed between them is resolved
// into `model.laidOutArcs`, so what is left is one list and two ways of painting
// it — a canvas on screen, one `<path>` per arc in the export. See
// `plugins/arc/CLAUDE.md` for why the split is that way round.

const Arcs = observer(function Arcs({ model }: { model: ArcDisplayModel }) {
  const { palette, typography } = useStyleTheme()
  const { laidOutArcs, hoveredFeature, hoveredArcKey, canvasWidth, height } =
    model
  const hoverColor = palette.text.primary
  const labelColor = palette.text.primary
  const haloColor = palette.background.paper
  // the size and family the `<text>` elements used to inherit through the
  // cascade, which a canvas does not
  const font = `${typography.fontSize}px ${typography.fontFamily}`

  const hitTest = useCallback(
    (state?: MouseState) => {
      const hit =
        state && !model.isLoadingOrCanceled
          ? hitTestArcs(state.x, state.y, laidOutArcs, canvasWidth)
          : undefined
      model.setHoveredFeature(hit?.feature, hit?.key)
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
        labelColor,
        haloColor,
      })
    },
    [
      laidOutArcs,
      hoveredFeature,
      hoverColor,
      canvasWidth,
      font,
      labelColor,
      haloColor,
    ],
  )

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
          <ArcTooltip contents={captionFor(laidOutArcs, hoveredArcKey)} />
        </Suspense>
      ) : null}
    </div>
  )
})

// By arc key, not by feature: two arcs can share one `Feature` (a BND with two
// ALTs), and finding by feature would answer with whichever of them laid out
// first however far away the other one is.
function captionFor(arcs: readonly LaidOutArc[], arcKey?: string) {
  return arcs.find(a => a.key === arcKey)?.caption
}

// No `<svg>` of its own — the export shell has already opened one, and a second
// would clip the arcs to a box inside the box they were laid out in. No cull
// either: the export captures the whole region.
//
// Draws no selection: a feature left selected from its detail widget would
// otherwise mark every figure exported afterwards, and no display's selection
// is exported.
//
// Not an observer, and it takes the arcs rather than the model: a figure is
// frozen, and `useFrozenFigureContract` fails any observer mounted inside one.
// It reads `laidOutArcs` — a computed over `bpToPx` and `offsetPx` — so as an
// observer it would slide the arcs across a body frozen at an older snapshot
// the next time the underlying view panned.
export function ArcsSvg({ arcs }: { arcs: readonly LaidOutArc[] }) {
  return arcs.map(arc => {
    const stroke = getStrokeProps(arc.color)
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
            y2={t.y2 ?? t.y}
          />
        ))}
        {arc.label ? <ArcLabel arc={arc} /> : null}
      </g>
    )
  })
}

// The halo-then-glyphs pair `drawArcs` spells as strokeText-then-fillText, at
// the theme's size: `arcLabelBaselineY` places a baseline for glyphs of one
// size, so the two paths have to agree on which.
function ArcLabel({ arc }: { arc: LaidOutArc }) {
  const { palette, typography } = useStyleTheme()
  return (
    <SvgHaloText
      x={arcMidX(arc.shape)}
      y={arcLabelBaselineY(arc)}
      fontSize={typography.fontSize}
      fontFamily={typography.fontFamily}
      halo={palette.background.paper}
      haloWidth={`${LABEL_HALO_EM}em`}
      fill={palette.text.primary}
    >
      {arc.label}
    </SvgHaloText>
  )
}

export default Arcs
