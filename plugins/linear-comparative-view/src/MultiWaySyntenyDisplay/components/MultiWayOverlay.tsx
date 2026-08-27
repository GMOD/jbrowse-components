import { useEffect, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { dropRowAt, moveLaneTo } from '../laneDrag.ts'
import { laneHeaderMenuItems } from '../menus.ts'

import type { Lane } from '../laneStack.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'

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

// The lane being dragged and the origin its ys are measured from — fixed for
// the whole gesture, so the listener effect can depend on it honestly. The
// moving y is its own state: it changes on every mousemove and re-binding
// window listeners that often is what the split avoids.
interface LaneDrag {
  assemblyName: string
  top: number
}

interface LaneMenu {
  assemblyName: string
  anchor: ContextMenuAnchor
}

const LABEL_FONT_SIZE = 10
const LABEL_CHAR_PX = 5.6

/**
 * The lane headers, the drag that reorders them and the menu each raises.
 * Press a mate lane's label, move it over another lane, release: the row
 * under the pointer is read off the lanes' band extents, and the drop writes
 * the whole order back the way the menu's Move up/down does, so the lanes the
 * drag did not touch stay where the reader saw them. A right-click on the
 * label, or a left-click on the glyph at its end, opens `laneHeaderMenuItems`.
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
  const [dragY, setDragY] = useState<number>()
  const [menu, setMenu] = useState<LaneMenu>()
  const menuLane = menu
    ? lanes.find(lane => lane.assemblyName === menu.assemblyName)
    : undefined
  const openMenu = (assemblyName: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({
      assemblyName,
      anchor: { clientX: event.clientX, clientY: event.clientY },
    })
  }
  const dropRow = dragY === undefined ? undefined : dropRowAt(lanes, dragY)
  // A drop on the ANCHOR's band lands the lane first below it — "above the
  // anchor" cannot be granted — so the bar goes on the first mate lane. The
  // indicator was suppressed entirely there, which left the most reachable
  // drop in the stack with no feedback at all
  const dropLane =
    dropRow === undefined ? undefined : lanes[Math.max(1, dropRow)]
  // The listeners are window-level because a drag leaves the label the moment
  // it starts, and they live in an effect so a display that unmounts UNDER a
  // held button — the track closed, the phase flipped to an error banner —
  // takes them with it. Bound outside one, `mouseup` still fired into a dead
  // component and wrote the order through a destroyed node.
  useEffect(() => {
    if (!drag) {
      return
    }
    const { assemblyName, top } = drag
    const yOf = (e: MouseEvent) => e.clientY - top
    const move = (e: MouseEvent) => {
      setDragY(yOf(e))
    }
    const up = (e: MouseEvent) => {
      setDrag(undefined)
      setDragY(undefined)
      const row = dropRowAt(model.laneStack.lanes, yOf(e))
      if (row !== undefined) {
        model.setRowOrder(
          moveLaneTo(model.rowAssemblies, assemblyName, row - 1),
        )
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [drag, model])

  const startDrag = (assemblyName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    const svg = event.currentTarget.closest('svg')
    const top = svg?.getBoundingClientRect().top ?? 0
    setDrag({ assemblyName, top })
    setDragY(event.clientY - top)
  }
  return (
    <>
      {dropLane && dropLane.assemblyName !== drag?.assemblyName ? (
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
        const label = [
          lane.assemblyName,
          where,
          lane.hasAnnotation ? undefined : '· no annotation',
        ]
          .filter(part => !!part)
          .join('  ')
        const y = lane.glyphTop - 3
        return (
          <g key={`header-${lane.assemblyName}`}>
            <text
              x={2}
              y={y}
              fontSize={LABEL_FONT_SIZE}
              fill={palette.text.primary}
              data-testid={`multiway-lane-label-${lane.assemblyName}`}
              style={{
                pointerEvents: 'all',
                cursor: lane.isAnchor ? undefined : drag ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
              onMouseDown={
                lane.isAnchor
                  ? undefined
                  : event => {
                      if (event.button === 0) {
                        startDrag(lane.assemblyName, event)
                      }
                    }
              }
              onContextMenu={event => {
                openMenu(lane.assemblyName, event)
              }}
            >
              {label}
            </text>
            <text
              x={2 + label.length * LABEL_CHAR_PX + 6}
              y={y}
              fontSize={LABEL_FONT_SIZE}
              fill={palette.text.secondary}
              data-testid={`multiway-lane-menu-${lane.assemblyName}`}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onMouseDown={event => {
                event.stopPropagation()
              }}
              onClick={event => {
                openMenu(lane.assemblyName, event)
              }}
            >
              ⋮
            </text>
            <text
              x={width - 2}
              y={y}
              fontSize={LABEL_FONT_SIZE}
              textAnchor="end"
              fill={palette.text.secondary}
            >
              {scaleLabelOf(lane, visibleBpSpan)}
            </text>
          </g>
        )
      })}
      {menuLane ? (
        <ContextMenu
          anchor={menu?.anchor}
          menuItems={() => laneHeaderMenuItems(model, menuLane)}
          onClose={() => {
            setMenu(undefined)
          }}
        />
      ) : null}
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
