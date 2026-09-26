import { readConfObject } from '@jbrowse/core/configuration'
import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { shapePath } from './shapePath.ts'
import { DIMMED_OPACITY } from './types.ts'

import type { Shape } from './shapes.ts'
import type { ChordDisplayModel, RibbonDisplayModel } from './types.ts'

type ShapeDisplay = ChordDisplayModel | RibbonDisplayModel

function testId(shape: Shape) {
  return `${shape.kind}-${shape.feature.id()}`
}

function paintProps(
  display: ShapeDisplay,
  shape: Shape,
  state: 'resting' | 'hovered' | 'selected',
) {
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
 * The shapes as SVG paths. The export draws every one; on screen the canvas
 * holds the resting shapes and this draws only the hovered and the selected,
 * over it, so a hover never repaints the figure. Each path carries the
 * shape's label as its title, which is the export's own annotation.
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
  const {
    radiusPx,
    bezierRadius,
    shapeAlpha,
    selectedFeatureId,
    hoveredFeatureId,
    highlightedFeatureIdSet,
  } = display
  // a hover is a screen state; the export draws the selection and nothing of
  // the pointer
  const hovered = only === 'highlighted' ? hoveredFeatureId : undefined
  const stateOf = (shape: Shape) => {
    const id = shape.feature.id()
    return id === hovered
      ? 'hovered'
      : id === selectedFeatureId
        ? 'selected'
        : 'resting'
  }
  const drawn: readonly Shape[] =
    only === 'all'
      ? display.shapes
      : [
          ...new Set(
            [hovered, selectedFeatureId].filter(id => id !== undefined),
          ),
        ]
          .map(id => display.shapeFor(id))
          .filter(shape => shape !== undefined)
  return (
    <g
      data-testid={testid}
      data-chord-count={only === 'all' ? drawn.length : display.drawnCount}
      pointerEvents="none"
      fillOpacity={only === 'all' ? shapeAlpha : undefined}
    >
      {only === 'highlighted' ? (
        // the disc the canvas draws this display in, the group's extent on
        // screen with nothing highlighted
        <circle r={radiusPx} fill="none" />
      ) : null}
      {drawn.map(shape => {
        const state = stateOf(shape)
        const dimmed =
          state !== 'hovered' &&
          highlightedFeatureIdSet?.has(shape.feature.id()) === false
        const opacity =
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
