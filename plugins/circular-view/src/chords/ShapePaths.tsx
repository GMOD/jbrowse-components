import { readConfObject } from '@jbrowse/core/configuration'
import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { shapePath } from './chordLayer.ts'
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
    shapes,
    radiusPx,
    bezierRadius,
    shapeAlpha,
    selectedFeatureId,
    hoveredFeatureId,
    highlightedFeatureIdSet,
  } = display
  // a hover is a screen state; the export draws the selection and nothing of
  // the pointer
  const stateOf = (shape: Shape) => {
    const id = shape.feature.id()
    return only === 'highlighted' && id === hoveredFeatureId
      ? 'hovered'
      : id === selectedFeatureId
        ? 'selected'
        : 'resting'
  }
  const drawn =
    only === 'all' ? shapes : shapes.filter(s => stateOf(s) !== 'resting')
  return (
    <g
      data-testid={testid}
      data-chord-count={shapes.length}
      pointerEvents="none"
      fillOpacity={only === 'all' ? shapeAlpha : undefined}
    >
      {drawn.map(shape => {
        const state = stateOf(shape)
        const dimmed =
          state !== 'hovered' &&
          highlightedFeatureIdSet?.has(shape.feature.id()) === false
        return (
          <path
            key={shape.feature.id()}
            data-testid={testId(shape)}
            d={shapePath(shape, radiusPx, bezierRadius)}
            opacity={dimmed ? DIMMED_OPACITY : undefined}
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
