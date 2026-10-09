import { readConfObject } from '@jbrowse/core/configuration'
import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { DIMMED_OPACITY } from './shaders/chordStage.generated.ts'
import { shapePath } from './shapePath.ts'

import type { Shape } from './shapes.ts'
import type { ChordDisplayModel, RibbonDisplayModel } from './types.ts'

type ShapeDisplay = ChordDisplayModel | RibbonDisplayModel

type ShapeState = 'resting' | 'hovered' | 'selected'

function testId(shape: Shape) {
  return `${shape.kind}-${shape.feature.id()}`
}

function paintProps(display: ShapeDisplay, shape: Shape, state: ShapeState) {
  const { feature } = shape
  const color =
    state === 'resting'
      ? undefined
      : (readConfObject(
          display.configuration,
          state === 'hovered' ? 'colorHover' : 'colorSelected',
          { feature },
        ) as string)
  return shape.kind === 'ribbon'
    ? color === undefined
      ? { fill: shape.fill }
      : getFillProps(color)
    : {
        fill: 'none',
        strokeWidth: state === 'hovered' ? 3 : 1,
        ...getStrokeProps(color ?? shape.stroke),
      }
}

/**
 * The hovered and the selected shape, the selected one on top. Each is found
 * by its record's lane rather than compared by id, since a breakend pair draws
 * one chord under its first record and the second record names it too.
 */
function highlightedShapes(display: ShapeDisplay) {
  const { hoveredFeatureId, selectedFeatureId } = display
  const hovered =
    hoveredFeatureId === undefined
      ? undefined
      : display.shapeFor(hoveredFeatureId)
  const selected =
    selectedFeatureId === undefined
      ? undefined
      : display.shapeFor(selectedFeatureId)
  return [
    ...(hovered ? [{ shape: hovered, state: 'hovered' as const }] : []),
    ...(selected && selected.feature.id() !== hovered?.feature.id()
      ? [{ shape: selected, state: 'selected' as const }]
      : []),
  ]
}

/**
 * The shapes as SVG paths. The export draws every one, resting, at the
 * display's own alpha; on screen the canvas holds the resting shapes and this
 * draws only the hovered and the selected, over it, so a hover never repaints
 * the figure. Each path carries the shape's label as its title, which is the
 * export's own annotation.
 */
const ShapePaths = observer(function ShapePaths({
  display,
  testid,
  only,
}: {
  display: ShapeDisplay
  testid: string
  only: 'highlighted' | 'all'
}) {
  const { radiusPx, bezierRadius, highlightedFeatureIdSet } = display
  // a hover and a selection say where the reader's pointer was, so the export
  // draws every shape resting
  const drawn: readonly { shape: Shape; state: ShapeState }[] =
    only === 'all'
      ? display.shapes.map(shape => ({ shape, state: 'resting' }))
      : highlightedShapes(display)
  const alpha = only === 'all' ? display.shapeAlpha : 1
  return (
    <g
      data-testid={testid}
      data-chord-count={only === 'all' ? drawn.length : display.drawnCount}
      pointerEvents="none"
    >
      {only === 'highlighted' ? (
        // the disc the canvas draws this display in, the group's extent on
        // screen with nothing highlighted
        <circle r={radiusPx} fill="none" />
      ) : null}
      {drawn.map(({ shape, state }) => {
        const dimmed =
          state !== 'hovered' &&
          highlightedFeatureIdSet?.has(shape.feature.id()) === false
        const opacity =
          alpha *
          (dimmed ? DIMMED_OPACITY : 1) *
          (state === 'resting' && shape.kind === 'ribbon' ? shape.opacity : 1)
        return (
          <path
            key={shape.feature.id()}
            data-testid={testId(shape)}
            d={shapePath(shape, radiusPx, bezierRadius)}
            opacity={opacity === 1 ? undefined : opacity}
            {...paintProps(display, shape, state)}
          >
            <title>{display.shapeLabel(shape.feature)}</title>
          </path>
        )
      })}
    </g>
  )
})

export default ShapePaths
