import { useRef, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { usePointerDrag } from '@jbrowse/core/util/usePointerDrag'
import { textHalo } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk, bandPalette } from '@jbrowse/synteny-core'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import { observer } from 'mobx-react'

import {
  dropRowAt,
  dropTargetRow,
  laneOrderAfterDrop,
  pastDragSlop,
  sortAfterDrop,
} from '../laneDrag.ts'
import {
  BADGE_PAD_PX,
  HEADER_GAP_PX,
  HEADER_INSET_PX,
  INLINE_CHIP_OPACITY,
  INLINE_CHIP_PAD_PX,
  LABEL_FONT_SIZE,
  LANE_COLOR_SWATCH_PX,
  LANE_COLOR_TINT,
  labelBoxTop,
} from '../laneHeader.ts'
import { laneHeaderMenuItems } from '../menus.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'
import type { ReactNode } from 'react'

const CHIP_BORDER_PX = 1

const useStyles = makeStyles()(theme => ({
  textButton: {
    all: 'unset',
    cursor: 'pointer',
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.accent}`,
      outlineOffset: 1,
    },
  },
  alsoOn: {
    pointerEvents: 'all',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}))

interface LanePress {
  assemblyName: string
  top: number
  startY: number
  armed: boolean
}

interface LaneMenu {
  assemblyName: string
  anchor: ContextMenuAnchor
}

const GutterNote = observer(function GutterNote({
  testId,
  top,
  width,
  children,
}: {
  testId: string
  top: number
  width: number
  children: ReactNode
}) {
  return (
    <div
      data-testid={testId}
      style={{
        position: 'absolute',
        left: 0,
        top: top - LABEL_FONT_SIZE / 2,
        width,
        textAlign: 'center',
        color: bandPalette.text.secondary,
        textShadow: textHalo(bandGroundColor()),
      }}
    >
      {children}
    </div>
  )
})

const LoadFailure = observer(function LoadFailure({
  model,
  error,
  testId,
  what,
}: {
  model: MultiWaySyntenyDisplayModel
  error: unknown
  testId: string
  what?: string
}) {
  const { classes } = useStyles()
  return (
    <span
      data-testid={testId}
      title={`${error}`}
      style={{ color: bandPalette.error.main, pointerEvents: 'all' }}
      onContextMenu={event => {
        event.stopPropagation()
      }}
    >
      {what ? `Failed to load ${what}` : 'Failed to load'}{' '}
      <button
        type="button"
        data-testid={`${testId}-retry`}
        className={classes.textButton}
        style={{ textDecoration: 'underline' }}
        onMouseDown={event => {
          event.stopPropagation()
        }}
        onClick={event => {
          event.stopPropagation()
          model.retryFailedLanes()
        }}
      >
        Retry
      </button>
    </span>
  )
})

const LaneHeaders = observer(function LaneHeaders({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const { classes } = useStyles()
  const { lanes } = model.laneStack
  const {
    canvasWidthPx: width,
    laneHeaderRows: rows,
    frozenDecisions: frozen,
  } = model
  const [dragLane, setDragLane] = useState<string>()
  const [dragY, setDragY] = useState<number>()
  const [menu, setMenu] = useState<LaneMenu>()
  const menuLane = menu
    ? lanes.find(lane => lane.assemblyName === menu.assemblyName)
    : undefined
  if (menu && !menuLane) {
    setMenu(undefined)
  }
  const openMenu = (
    assemblyName: string,
    event: React.MouseEvent,
    anchor: ContextMenuAnchor = event,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({
      assemblyName,
      anchor: { clientX: anchor.clientX, clientY: anchor.clientY },
    })
  }
  const anchorMoves = model.laneField === 'refName'
  // pointer ys are viewport-relative and the lanes are in stack px
  const { scrollTop } = model
  const dropRow =
    dragY === undefined || dragLane === undefined
      ? undefined
      : dropTargetRow(
          model.laneOrder,
          dragLane,
          dropRowAt(lanes, dragY + scrollTop),
          model.anchorAssemblyName,
        )
  const dropIndex = dropRow ?? -1
  const dropLane = lanes[dropIndex]
  const dragIndex = lanes.findIndex(lane => lane.assemblyName === dragLane)

  const pressRef = useRef<LanePress | undefined>(undefined)
  const pointer = usePointerDrag({
    onDragStart: event => {
      const label = event.currentTarget
      const assemblyName =
        label instanceof HTMLElement ? label.dataset.laneDrag : undefined
      const top =
        label.closest('[data-lane-headers]')?.getBoundingClientRect().top ?? 0
      pressRef.current =
        assemblyName === undefined
          ? undefined
          : { assemblyName, top, startY: event.clientY - top, armed: false }
      setDragLane(pressRef.current?.assemblyName)
    },
    onDrag: event => {
      const press = pressRef.current
      if (press) {
        const y = event.clientY - press.top
        press.armed ||= pastDragSlop(press.startY, y)
        if (press.armed) {
          setDragY(y)
        }
      }
    },
    onDragEnd: event => {
      const press = pressRef.current
      pressRef.current = undefined
      setDragLane(undefined)
      setDragY(undefined)
      const order =
        press?.armed && event.type === 'pointerup'
          ? laneOrderAfterDrop(
              model.laneOrder,
              press.assemblyName,
              dropRowAt(
                model.laneStack.lanes,
                event.clientY - press.top + model.scrollTop,
              ),
              model.anchorAssemblyName,
            )
          : undefined
      if (order) {
        model.setDomain(
          sortAfterDrop(
            model.domain,
            order,
            model.anchorAssemblyName,
            model.laneKey,
          ),
        )
      }
    },
  })

  // text on the gene row reads over the genes it covers
  const inlineChip = {
    background: `color-mix(in srgb, ${bandGroundColor()} ${INLINE_CHIP_OPACITY * 100}%, transparent)`,
    padding: `0 ${INLINE_CHIP_PAD_PX}px`,
    borderRadius: 2,
  }

  const colorChip = (color: string) => ({
    background: `color-mix(in srgb, ${color} ${LANE_COLOR_TINT * 100}%, ${bandGroundColor()})`,
    padding: `0 ${INLINE_CHIP_PAD_PX}px`,
    borderRadius: 2,
    textShadow: 'none',
  })

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
        <GutterNote
          key={`loading-${y}`}
          testId="multiway-gutter-loading"
          top={y - scrollTop}
          width={width}
        >
          Loading alignments…
        </GutterNote>
      ))}
      {model.unheldGutters.map(({ y, labels }) => (
        <GutterNote
          key={`unheld-${y}`}
          testId="multiway-gutter-unheld"
          top={y - scrollTop}
          width={width}
        >
          Add {labels.join(' and ')} as an assembly to draw these ribbons
        </GutterNote>
      ))}
      {model.failedGutters.map(({ y, error }) => (
        <GutterNote
          key={`failed-${y}`}
          testId="multiway-gutter-failed"
          top={y - scrollTop}
          width={width}
        >
          <LoadFailure
            model={model}
            error={error}
            testId="multiway-gutter-failure"
            what="alignments"
          />
        </GutterNote>
      ))}
      {rows.map(row => (
        <div
          key={`header-${row.assemblyName}`}
          style={{
            position: 'absolute',
            left: HEADER_INSET_PX,
            // `row.y` is a baseline, and the box is placed by its top
            top: labelBoxTop(row.y) - scrollTop,
            width: width - 2 * HEADER_INSET_PX,
            display: 'flex',
            alignItems: 'center',
            gap: HEADER_GAP_PX,
            whiteSpace: 'nowrap',
            textShadow: textHalo(bandGroundColor()),
          }}
          // a right-click on a header control is not one on the gene under it
          onContextMenu={event => {
            event.stopPropagation()
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
                padding: `0 ${BADGE_PAD_PX}px`,
                borderRadius: 2,
                textShadow: 'none',
                flex: '0 0 auto',
              }}
            >
              vs {row.against}
            </span>
          ) : null}
          {row.color ? (
            <span
              data-testid={`multiway-lane-color-${row.assemblyName}`}
              style={{
                width: LANE_COLOR_SWATCH_PX,
                height: LABEL_FONT_SIZE,
                backgroundColor: row.color,
                flex: '0 0 auto',
              }}
            />
          ) : null}
          <span
            data-testid={`multiway-lane-label-${row.assemblyName}`}
            style={{
              color: bandInk().text,
              pointerEvents: 'all',
              cursor:
                row.isAnchor && !anchorMoves
                  ? undefined
                  : dragLane
                    ? 'grabbing'
                    : 'grab',
              userSelect: 'none',
              touchAction: row.isAnchor && !anchorMoves ? undefined : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              ...(row.inline ? inlineChip : {}),
              ...(row.color ? colorChip(row.color) : {}),
            }}
            {...(row.isAnchor && !anchorMoves
              ? {}
              : {
                  ...pointer,
                  'data-lane-drag': row.assemblyName,
                  'data-gesture-owner': 'true',
                  onMouseDown: (event: React.MouseEvent) => {
                    event.stopPropagation()
                    event.preventDefault()
                  },
                })}
            onContextMenu={event => {
              openMenu(row.assemblyName, event)
            }}
          >
            {row.label}
          </span>
          {row.alsoOn ? (
            <button
              type="button"
              data-testid={`multiway-lane-also-on-${row.assemblyName}`}
              className={`${classes.textButton} ${classes.alsoOn}`}
              style={{ color: bandInk().text, flex: '0 1 auto' }}
              onMouseDown={event => {
                event.stopPropagation()
              }}
              onClick={event => {
                event.stopPropagation()
                model.setLaneField('refName')
              }}
            >
              {row.alsoOn}
            </button>
          ) : null}
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
            aria-label={`${model.laneLabel(row.assemblyName)} lane options`}
            data-testid={`multiway-lane-menu-${row.assemblyName}`}
            className={classes.textButton}
            style={{
              color: bandPalette.text.secondary,
              pointerEvents: 'all',
              flex: '0 0 auto',
            }}
            onMouseDown={event => {
              event.stopPropagation()
            }}
            onClick={event => {
              // a keyboard click reports 0,0, so the menu opens under the button
              const box = event.currentTarget.getBoundingClientRect()
              openMenu(row.assemblyName, event, {
                clientX: box.left,
                clientY: box.bottom,
              })
            }}
          >
            ⋮
          </button>
          {model.laneFetchErrors.has(row.assemblyName) ? (
            <LoadFailure
              model={model}
              error={model.laneFetchErrors.get(row.assemblyName)}
              testId={`multiway-lane-failed-${row.assemblyName}`}
            />
          ) : null}
          {row.changes ? (
            <span
              data-testid={`multiway-lane-changes-${row.assemblyName}`}
              title={`against ${row.changes.anchor}`}
              style={{
                marginLeft: 'auto',
                padding: `0 ${INLINE_CHIP_PAD_PX}px`,
                border: `${CHIP_BORDER_PX}px solid ${bandPalette.text.secondary}`,
                borderRadius: 2,
                background: bandGroundColor(),
                color: bandInk().text,
                textShadow: 'none',
                pointerEvents: 'all',
                flex: '0 0 auto',
              }}
            >
              {row.changes.text}
            </span>
          ) : null}
          <span
            title={row.scaleTitle}
            style={{
              marginLeft: row.changes ? undefined : 'auto',
              color: bandPalette.text.secondary,
              flex: '0 0 auto',
              pointerEvents: row.scaleTitle ? 'all' : undefined,
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
