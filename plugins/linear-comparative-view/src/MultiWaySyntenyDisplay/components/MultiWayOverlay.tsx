import { useState } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { dropRowAt, moveLaneTo } from '../laneDrag.ts'

import type { Lane } from '../laneStack.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'

/**
 * What a lane's header says on the right: the span, because a range makes the
 * reader subtract two eight-digit numbers to answer "how zoomed is this lane",
 * and the multiple only where it is not 1 — so a stack of lanes at the anchor's
 * own scale says so by staying quiet. Against `visibleBpSpan`, which is the
 * unit the ladder rounded the lane's span to.
 */
function scaleLabelOf(lane: Lane, visibleBpSpan: number) {
  if (lane.isAnchor) {
    return visibleBpSpan > 0 ? getBpDisplayStr(visibleBpSpan) : ''
  }
  if (lane.frame === undefined) {
    return ''
  }
  const laneSpan = lane.frame.max - lane.frame.min
  const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
  return multiple > 1.02
    ? `${getBpDisplayStr(laneSpan)}  ${Number(multiple.toFixed(1))}×`
    : getBpDisplayStr(laneSpan)
}

interface LaneDrag {
  assemblyName: string
  y: number
}

/**
 * The lane headers, and the drag that reorders them: press a mate lane's
 * label, move it over another lane, release. The row under the pointer is
 * read off the lanes' band extents, and the drop writes the whole order back
 * the way the menu's Move up/down does, so the lanes the drag did not touch
 * stay where the reader saw them.
 */
const LaneHeaders = observer(function LaneHeaders({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const view = model.lgv
  const { lanes } = model.laneStack
  const { visibleBpSpan, canvasWidth: width } = model
  const [drag, setDrag] = useState<LaneDrag>()
  const dropRow = drag ? dropRowAt(lanes, drag.y) : undefined
  const dropLane = dropRow === undefined ? undefined : lanes[dropRow]
  const startDrag = (assemblyName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    const svg = event.currentTarget.closest('svg')
    const top = svg?.getBoundingClientRect().top ?? 0
    const yOf = (e: MouseEvent) => e.clientY - top
    setDrag({ assemblyName, y: event.clientY - top })
    const move = (e: MouseEvent) => {
      setDrag({ assemblyName, y: yOf(e) })
    }
    const up = (e: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setDrag(undefined)
      const row = dropRowAt(model.laneStack.lanes, yOf(e))
      if (row !== undefined) {
        model.setRowOrder(
          moveLaneTo(model.rowAssemblies, assemblyName, row - 1),
        )
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return (
    <>
      {dropLane &&
      !dropLane.isAnchor &&
      dropLane.assemblyName !== drag?.assemblyName ? (
        <g data-testid="multiway-lane-drop">
          <rect
            x={0}
            y={dropLane.bandStart}
            width={width}
            height={dropLane.bandEnd - dropLane.bandStart}
            fill={palette.action.hover}
          />
          <rect
            x={0}
            y={dropLane.bandStart}
            width={width}
            height={2}
            fill={palette.primary.main}
          />
        </g>
      ) : null}
      {lanes.map(lane => {
        const where = lane.isAnchor
          ? view.coarseVisibleLocStrings || view.visibleLocStrings
          : lane.frame &&
            `${lane.canon(lane.frame.refName)}:${toLocale(Math.round(lane.frame.min))}${lane.frame.flipped ? ' [rev]' : ''}`
        return (
          <g key={`header-${lane.assemblyName}`}>
            <text
              x={2}
              y={lane.glyphTop - 3}
              fontSize={10}
              fill={palette.text.primary}
              data-testid={`multiway-lane-label-${lane.assemblyName}`}
              style={
                lane.isAnchor
                  ? undefined
                  : {
                      pointerEvents: 'all',
                      cursor: drag ? 'grabbing' : 'grab',
                      userSelect: 'none',
                    }
              }
              onMouseDown={
                lane.isAnchor
                  ? undefined
                  : event => {
                      startDrag(lane.assemblyName, event)
                    }
              }
            >
              {/* `no annotation` is a claim about the SESSION, so it asks
                  whether a track exists rather than whether this window drew
                  any genes */}
              {[
                lane.assemblyName,
                where,
                lane.hasAnnotation ? undefined : '· no annotation',
              ]
                .filter(part => !!part)
                .join('  ')}
            </text>
            <text
              x={width - 2}
              y={lane.glyphTop - 3}
              fontSize={10}
              textAnchor="end"
              fill={palette.text.secondary}
            >
              {scaleLabelOf(lane, visibleBpSpan)}
            </text>
          </g>
        )
      })}
    </>
  )
})

/**
 * The hovered group outlined in every lane that places it. A ribbon joins
 * ADJACENT lanes only, so a group the middle lane does not place would light
 * up nothing at all without this, and the glyph the reader is looking at
 * never moved.
 */
const GroupHighlight = observer(function GroupHighlight({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const { glyphHeight } = model.laneStack
  return (
    <g transform={`translate(${model.dragOffsetPx} 0)`}>
      {model.hoveredGroupOutlines.map(({ lane, span }) => (
        <rect
          key={`hover-${lane.assemblyName}-${span[0]}-${span[1]}`}
          data-testid="multiway-hover-outline"
          x={Math.min(span[0], span[1]) - 1}
          y={lane.glyphTop - 1}
          width={Math.max(2, Math.abs(span[1] - span[0]) + 2)}
          height={glyphHeight + 2}
          fill="none"
          stroke={palette.text.primary}
        />
      ))}
    </g>
  )
})

/**
 * The vector layer over the canvas: the hover outline, which follows the
 * stack's scroll, and the lane headers, which are chrome pinned to the track
 * and go last so a ribbon never crosses a label. The export renders the same
 * two over its paint layer.
 */
const MultiWayOverlay = observer(function MultiWayOverlay({
  model,
  exportSVG,
}: {
  model: MultiWaySyntenyDisplayModel
  exportSVG?: boolean
}) {
  const body = (
    <>
      <GroupHighlight model={model} />
      <LaneHeaders model={model} />
    </>
  )
  return exportSVG ? (
    body
  ) : (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: model.canvasWidth,
        height: model.height,
        pointerEvents: 'none',
      }}
    >
      {body}
    </svg>
  )
})

export default MultiWayOverlay
