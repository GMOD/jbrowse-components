import { useEffect, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { mergeDomain } from '@jbrowse/display-kit/groupByMenu'
import { textHalo } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk, bandPalette } from '@jbrowse/synteny-core'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import { observer } from 'mobx-react'

import { dropRowAt, laneOrderAfterDrop, pastDragSlop } from '../laneDrag.ts'
import {
  INLINE_CHIP_OPACITY,
  INLINE_CHIP_PAD_PX,
  LABEL_FONT_SIZE,
  labelBoxTop,
} from '../laneHeader.ts'
import { laneHeaderMenuItems } from '../menus.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'

// fixed per gesture; the moving y is its own state so the listeners bind once
interface LaneDrag {
  assemblyName: string
  top: number
  startY: number
}

interface LaneMenu {
  assemblyName: string
  anchor: ContextMenuAnchor
}

const LaneHeaders = observer(function LaneHeaders({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const { lanes } = model.laneStack
  const {
    canvasWidth: width,
    laneHeaderRows: rows,
    frozenDecisions: frozen,
  } = model
  const [drag, setDrag] = useState<LaneDrag>()
  const [dragY, setDragY] = useState<number>()
  const [menu, setMenu] = useState<LaneMenu>()
  const menuLane = menu
    ? lanes.find(lane => lane.assemblyName === menu.assemblyName)
    : undefined
  if (menu && !menuLane) {
    setMenu(undefined)
  }
  const openMenu = (assemblyName: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({
      assemblyName,
      anchor: { clientX: event.clientX, clientY: event.clientY },
    })
  }
  // pointer ys are viewport-relative and the lanes are in stack px
  const { scrollTop } = model
  const dropRow =
    dragY === undefined ? undefined : dropRowAt(lanes, dragY + scrollTop)
  // a drop on the anchor's band lands the lane first below it
  const dropIndex = dropRow === undefined ? -1 : Math.max(1, dropRow)
  const dropLane = lanes[dropIndex]
  const dragIndex = lanes.findIndex(
    lane => lane.assemblyName === drag?.assemblyName,
  )

  // in an effect, so a display unmounting under a held button drops them
  useEffect(() => {
    if (!drag) {
      return
    }
    const { assemblyName, top, startY } = drag
    const yOf = (e: MouseEvent) => e.clientY - top
    let armed = false
    const move = (e: MouseEvent) => {
      const y = yOf(e)
      armed ||= pastDragSlop(startY, y)
      if (armed) {
        setDragY(y)
      }
    }
    const up = (e: MouseEvent) => {
      setDrag(undefined)
      setDragY(undefined)
      const order = armed
        ? laneOrderAfterDrop(
            model.rowAssemblies,
            assemblyName,
            dropRowAt(model.laneStack.lanes, yOf(e) + model.scrollTop),
          )
        : undefined
      if (order) {
        model.setDomain(mergeDomain([...model.domain], order))
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [drag, model])

  // text on the gene row reads over the genes it covers
  const inlineChip = {
    background: `color-mix(in srgb, ${bandGroundColor()} ${INLINE_CHIP_OPACITY * 100}%, transparent)`,
    padding: `0 ${INLINE_CHIP_PAD_PX}px`,
    borderRadius: 2,
  }

  const startDrag = (assemblyName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    const box = event.currentTarget.closest('[data-lane-headers]')
    const top = box?.getBoundingClientRect().top ?? 0
    setDrag({ assemblyName, top, startY: event.clientY - top })
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
      {dropLane && dropIndex !== dragIndex ? (
        <div
          data-testid="multiway-lane-drop"
          style={{
            position: 'absolute',
            left: 0,
            top: dropLane.bandStart - scrollTop,
            width,
            height: dropLane.bandEnd - dropLane.bandStart,
            background: palette.action.hover,
            [dropIndex > dragIndex ? 'borderBottom' : 'borderTop']:
              `2px solid ${palette.accent}`,
            boxSizing: 'border-box',
          }}
        />
      ) : null}
      {model.loadingGutterYs.map(y => (
        <div
          key={`loading-${y}`}
          data-testid="multiway-gutter-loading"
          style={{
            position: 'absolute',
            left: 0,
            top: y - scrollTop - LABEL_FONT_SIZE / 2,
            width,
            textAlign: 'center',
            color: bandPalette.text.secondary,
            textShadow: textHalo(bandGroundColor()),
          }}
        >
          Loading alignments…
        </div>
      ))}
      {rows.map(row => (
        <div
          key={`header-${row.assemblyName}`}
          style={{
            position: 'absolute',
            left: 2,
            // `row.y` is a baseline, and the box is placed by its top
            top: labelBoxTop(row.y) - scrollTop,
            width: width - 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            textShadow: textHalo(bandGroundColor()),
          }}
        >
          {row.against ? (
            <span
              data-testid={`multiway-lane-against-${row.assemblyName}`}
              style={{
                background: bandGroundColor(),
                color: bandInk().text,
                border: `1px solid ${bandInk().text}`,
                fontWeight: 600,
                padding: '0 3px',
                borderRadius: 2,
                textShadow: 'none',
                flex: '0 0 auto',
              }}
            >
              vs {row.against}
            </span>
          ) : null}
          <span
            data-testid={`multiway-lane-label-${row.assemblyName}`}
            style={{
              color: bandInk().text,
              pointerEvents: 'all',
              cursor: row.isAnchor ? undefined : drag ? 'grabbing' : 'grab',
              userSelect: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              ...(row.inline ? inlineChip : {}),
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
          {frozen.has(row.assemblyName) ? (
            <AcUnitIcon
              data-testid={`multiway-lane-frozen-${row.assemblyName}`}
              titleAccess="Frozen: drag or side-scroll the lane to slide it"
              style={{
                fontSize: LABEL_FONT_SIZE,
                color: bandPalette.text.secondary,
                pointerEvents: 'all',
                flex: '0 0 auto',
              }}
            />
          ) : null}
          <button
            type="button"
            aria-label={`${row.assemblyName} lane options`}
            data-testid={`multiway-lane-menu-${row.assemblyName}`}
            style={{
              all: 'unset',
              color: bandPalette.text.secondary,
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
              color: bandPalette.text.secondary,
              flex: '0 0 auto',
              ...(row.inline ? inlineChip : {}),
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
