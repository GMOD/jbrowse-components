import { readConfObject } from '@jbrowse/core/configuration'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import { geneGlyphPx, isAnnotated } from '../geneGlyph.ts'

import type { Lane } from '../laneStack.ts'
import type { Span } from '../layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'

// half a screen either side of the canvas too: the stack is translated rather
// than relaid between settles, so what a drag can pull into view before the
// next one has to be drawn already
function onCanvas(span: Span, width: number) {
  return (
    Math.max(span[0], span[1]) >= -width / 2 &&
    Math.min(span[0], span[1]) <= 1.5 * width
  )
}

// One gene drawn as its merged CDS/UTR boxes on an intron midline. All the
// geometry is `geneGlyphPx`; this maps it to elements and nothing else.
function GeneGlyph({
  feature,
  span,
  lane,
  y,
  glyphHeight,
  canvasWidth,
  color,
  utrColor,
  strokeColor,
  onClick,
}: {
  feature: Feature
  span: Span
  lane: Lane
  y: number
  glyphHeight: number
  canvasWidth: number
  color: string
  utrColor: string
  strokeColor: string
  onClick: () => void
}) {
  const refName = feature.get('refName')
  const { left, right, mid, full, thin, utrY, utrHeight, chevrons, arrow } =
    geneGlyphPx(
      feature,
      span,
      (start, end) => lane.spanOf(refName, start, end),
      { y, glyphHeight, canvasWidth },
    )
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => {
        onClick()
      }}
    >
      <line x1={left} x2={right} y1={mid} y2={mid} stroke={strokeColor} />
      {chevrons ? <path d={chevrons} stroke={strokeColor} fill="none" /> : null}
      {thin.map(([x1, x2]) => (
        <rect
          key={`utr-${x1}-${x2}`}
          x={x1}
          y={utrY}
          width={Math.max(1, x2 - x1)}
          height={utrHeight}
          fill={utrColor}
        />
      ))}
      {full.map(([x1, x2]) => (
        <rect
          key={`cds-${x1}-${x2}`}
          x={x1}
          y={y}
          width={Math.max(1, x2 - x1)}
          height={glyphHeight}
          fill={color}
        />
      ))}
      {arrow ? <path d={arrow} stroke={strokeColor} fill="none" /> : null}
      <title>{feature.get('name') ?? feature.id()}</title>
    </g>
  )
}

/**
 * What each lane draws on its own baseline: its gene models where it has an
 * annotation, and the table's own placement box where it does not.
 *
 * The one expensive layer — a jexl color slot resolved per glyph — which is why
 * the hover lives in layers of its own rather than in here.
 */
export const LaneGlyphs = observer(function LaneGlyphs({
  model,
  exportSVG,
}: {
  model: MultiWaySyntenyDisplayModel
  exportSVG?: boolean
}) {
  const palette = usePalette()
  const { lanes, glyphHeight } = model.laneStack
  const { selectedFeatureId, canvasWidth: width } = model
  const colorOf = (slot: 'color' | 'utrColor', feature: Feature) =>
    selectedFeatureId === feature.id()
      ? palette.highlight.main
      : readConfObject(model.configuration, slot, { feature })

  return (
    <>
      {lanes.map(lane => {
        const y = lane.glyphTop
        // the genes this lane can actually draw, not the ones it fetched: the
        // fetch covers the whole window the frame slides in, so a frame over a
        // gene desert can hold a non-empty list and show none of it. Culled to
        // the canvas on screen, the way the arc display culls, and kept whole
        // on the export path, which captures the region rather than the
        // viewport: the anchor lane's fetch spans the static blocks, so a third
        // of what it holds is off either edge
        const drawn = lane.genes.flatMap(gene => {
          const span = lane.spanOf(
            gene.get('refName'),
            gene.get('start'),
            gene.get('end'),
          )
          return span === undefined || (!exportSVG && !onCanvas(span, width))
            ? []
            : [{ gene, span }]
        })
        const annotated = drawn.map(d => d.span)
        return (
          <g key={`lane-${lane.assemblyName}`}>
            <line
              x1={0}
              x2={width}
              y1={y + glyphHeight / 2}
              y2={y + glyphHeight / 2}
              stroke={palette.divider}
            />
            {drawn.map(({ gene, span }) => (
              <GeneGlyph
                key={`gene-${gene.id()}`}
                feature={gene}
                span={span}
                lane={lane}
                y={y}
                glyphHeight={glyphHeight}
                canvasWidth={width}
                strokeColor={palette.text.primary}
                color={colorOf('color', gene)}
                utrColor={colorOf('utrColor', gene)}
                onClick={() => {
                  model.selectFeature(gene)
                }}
              />
            ))}
            {/* Where the lane has no annotation over a group it places, the
                table's own gene span, outlined rather than filled: without that
                the stack states a placement box and a real gene model in the
                same ink, and one flat box across a lane reads as a single
                enormous gene.

                Per GROUP rather than per lane. Per lane, one drawn gene
                anywhere suppressed every box, so a table pairing genes the
                lane's GFF3 does not name left the ribbons for those hanging off
                nothing at all. */}
            {[...lane.placements].flatMap(([key, { group, spans }]) =>
              spans.flatMap(span => {
                if (isAnnotated(annotated, span)) {
                  return []
                }
                // a box, unlike a ribbon, wants the ends the low-to-high way round
                const [boxLeft, boxRight] =
                  span[0] <= span[1] ? span : [span[1], span[0]]
                const color = colorOf('color', group.feature)
                return [
                  <rect
                    key={`glyph-${key}-${span[0]}-${span[1]}`}
                    x={boxLeft}
                    y={y + 1}
                    width={Math.max(1, boxRight - boxLeft)}
                    height={Math.max(1, glyphHeight - 2)}
                    fill={color}
                    fillOpacity={0.25}
                    stroke={color}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      model.selectFeature(group.feature)
                    }}
                    onMouseEnter={() => {
                      model.setHoveredGroupKey(key)
                    }}
                    onMouseLeave={() => {
                      model.setHoveredGroupKey(undefined)
                    }}
                  >
                    <title>{key}</title>
                  </rect>,
                ]
              }),
            )}
          </g>
        )
      })}
    </>
  )
})
