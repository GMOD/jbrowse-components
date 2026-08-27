import { useEffect, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import { dropRowAt, moveLaneTo } from '../laneDrag.ts'
import { LABEL_FONT_SIZE, labelBoxTop, laneHeaderRows } from '../laneHeader.ts'
import { laneHeaderMenuItems } from '../menus.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'

// The lane being dragged and the origin its ys are measured from — fixed for
// the whole gesture, so the listener effect can depend on it honestly. The
// moving y is its own state: it changes on every mousemove, and re-binding
// window listeners that often is what the split avoids.
interface LaneDrag {
  assemblyName: string
  top: number
}

interface LaneMenu {
  assemblyName: string
  anchor: ContextMenuAnchor
}

/**
 * The lane headers, the drag that reorders them and the menu each raises.
 *
 * HTML rather than SVG, which is the whole point of it being a component of
 * its own: the browser places the menu affordance after the label instead of a
 * character-count estimate doing it, a long label ellipsizes instead of running
 * under the scale, and the affordance is a real focusable button rather than a
 * `<text>` with a click handler. `SvgLaneHeaders` draws the caption half for an
 * exported figure, where none of that belongs.
 *
 * Press a mate lane's label, move it over another lane, release: the row under
 * the pointer is read off the lanes' band extents, and the drop writes the
 * whole order back the way the menu's Move up/down does, so the lanes the drag
 * did not touch stay where the reader saw them.
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
  const rows = laneHeaderRows(
    lanes,
    visibleBpSpan,
    view.coarseVisibleLocStrings || view.visibleLocStrings,
  )
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
  // anchor" cannot be granted — so the bar goes on the first mate lane
  const dropLane =
    dropRow === undefined ? undefined : lanes[Math.max(1, dropRow)]

  // Window-level because a drag leaves the label the moment it starts, and in
  // an effect so a display that unmounts UNDER a held button takes them with
  // it rather than writing the order through a destroyed node on mouseup.
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
    const box = event.currentTarget.closest('[data-lane-headers]')
    const top = box?.getBoundingClientRect().top ?? 0
    setDrag({ assemblyName, top })
    setDragY(event.clientY - top)
  }

  return (
    <div
      data-lane-headers
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height: model.height,
        pointerEvents: 'none',
        fontSize: LABEL_FONT_SIZE,
        lineHeight: 1,
      }}
    >
      {dropLane && dropLane.assemblyName !== drag?.assemblyName ? (
        <div
          data-testid="multiway-lane-drop"
          style={{
            position: 'absolute',
            left: 0,
            top: dropLane.bandStart,
            width,
            height: dropLane.bandEnd - dropLane.bandStart,
            background: palette.action.hover,
            borderTop: `2px solid ${palette.primary.main}`,
            boxSizing: 'border-box',
          }}
        />
      ) : null}
      {rows.map(row => (
        <div
          key={`header-${row.assemblyName}`}
          style={{
            position: 'absolute',
            left: 2,
            // `row.y` is a baseline; this converts it to the box top so the
            // two presenters put the text on the same line
            top: labelBoxTop(row.y),
            width: width - 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            data-testid={`multiway-lane-label-${row.assemblyName}`}
            style={{
              color: palette.text.primary,
              pointerEvents: 'all',
              cursor: row.isAnchor ? undefined : drag ? 'grabbing' : 'grab',
              userSelect: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onMouseDown={
              row.isAnchor
                ? undefined
                : event => {
                    if (event.button === 0) {
                      startDrag(row.assemblyName, event)
                    }
                  }
            }
            onContextMenu={event => {
              openMenu(row.assemblyName, event)
            }}
          >
            {row.label}
          </span>
          <button
            type="button"
            aria-label={`${row.assemblyName} lane options`}
            data-testid={`multiway-lane-menu-${row.assemblyName}`}
            style={{
              all: 'unset',
              color: palette.text.secondary,
              pointerEvents: 'all',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
            onMouseDown={event => {
              event.stopPropagation()
            }}
            onClick={event => {
              openMenu(row.assemblyName, event)
            }}
          >
            ⋮
          </button>
          <span
            style={{
              marginLeft: 'auto',
              color: palette.text.secondary,
              flex: '0 0 auto',
            }}
          >
            {row.scale}
          </span>
        </div>
      ))}
      {menuLane ? (
        <ContextMenu
          anchor={menu?.anchor}
          menuItems={() => laneHeaderMenuItems(model, menuLane)}
          onClose={() => {
            setMenu(undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default LaneHeaders
