import React, { useRef, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import {
  Popover,
  Tooltip,
  Typography,
  makeStyles,
  alpha,
} from '@material-ui/core'
import { stringify } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'
import { LinearComparativeViewModel, BpOffset } from '../model'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles(theme => {
  const background = theme.palette.tertiary
    ? alpha(theme.palette.tertiary.main, 0.7)
    : alpha(theme.palette.primary.main, 0.7)
  return {
    rubberBand: {
      height: '100%',
      background,
      position: 'absolute',
      zIndex: 10,
      textAlign: 'center',
      overflow: 'hidden',
    },
    rubberBandControl: {
      cursor: 'crosshair',
      width: '100%',
      minHeight: 8,
    },
    rubberBandText: {
      color: theme.palette.tertiary
        ? theme.palette.tertiary.contrastText
        : theme.palette.primary.contrastText,
    },
    popover: {
      mouseEvents: 'none',
      cursor: 'crosshair',
    },
    paper: {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    guide: {
      pointerEvents: 'none',
      height: '100%',
      width: 1,
      position: 'absolute',
      zIndex: 10,
    },
  }
})

const VerticalGuide = observer(
  ({ model, coordX }: { model: LCV; coordX: number }) => {
    const classes = useStyles()
    //stringify(model.pxToBp(coordX))}
    return (
      <Tooltip open placement="top" title={''} arrow>
        <div
          className={classes.guide}
          style={{
            left: coordX,
            background: 'red',
          }}
        />
      </Tooltip>
    )
  },
)

function RubberBand({
  model,
  ControlComponent = <div />,
}: {
  model: LCV
  ControlComponent?: React.ReactElement
}) {
  console.log('here')
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()

  // clientX and clientY used for anchorPosition for menu
  // offsetX used for calculations about width of selection
  const [anchorPosition, setAnchorPosition] = useState<{
    offsetX: number
    clientX: number
    clientY: number
  }>()
  const [guideX, setGuideX] = useState<number | undefined>()
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()
  const mouseDragging = startX !== undefined && anchorPosition === undefined

  useEffect(() => {
    function computeOffsets(offsetX: number, view: LGV) {
      if (startX === undefined) {
        return
      }
      let leftPx = startX
      let rightPx = offsetX
      // handles clicking and draging to the left
      if (rightPx < leftPx) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      const leftOffset = view.pxToBp(leftPx)
      const rightOffset = view.pxToBp(rightPx)

      return { leftOffset, rightOffset }
    }

    function globalMouseMove(event: MouseEvent) {
      if (controlsRef.current && mouseDragging) {
        const relativeX =
          event.clientX - controlsRef.current.getBoundingClientRect().left
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      if (startX !== undefined && controlsRef.current) {
        const { clientX, clientY } = event
        const ref = controlsRef.current
        const offsetX = clientX - ref.getBoundingClientRect().left
        // as stated above, store both clientX/Y and offsetX for different
        // purposes
        setAnchorPosition({
          offsetX,
          clientX,
          clientY,
        })
        model.views.forEach(view => {
          const { leftOffset, rightOffset } = computeOffsets(offsetX, view) as {
            leftOffset: BpOffset
            rightOffset: BpOffset
          }
          view.setOffsets(leftOffset, rightOffset)
        })
        setGuideX(undefined)
      }
    }
    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove)
      window.addEventListener('mouseup', globalMouseUp)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove)
        window.removeEventListener('mouseup', globalMouseUp)
      }
    }
    return () => {}
  }, [startX, mouseDragging, anchorPosition, model])

  useEffect(() => {
    if (
      !mouseDragging &&
      currentX !== undefined &&
      startX !== undefined &&
      Math.abs(currentX - startX) <= 3
    ) {
      handleClose()
    }
  }, [mouseDragging, currentX, startX])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const relativeX =
      event.clientX -
      (event.target as HTMLDivElement).getBoundingClientRect().left
    setStartX(relativeX)
    setCurrentX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLDivElement
    setGuideX(event.clientX - target.getBoundingClientRect().left)
  }

  function mouseOut() {
    setGuideX(undefined)
    model.views.forEach(view => view.setOffsets(undefined, undefined))
  }

  function handleClose() {
    setAnchorPosition(undefined)
    setStartX(undefined)
    setCurrentX(undefined)
  }

  const open = Boolean(anchorPosition)

  function handleMenuItemClick(_: unknown, callback: Function) {
    callback()
    handleClose()
  }

  if (startX === undefined) {
    return (
      <>
        {guideX !== undefined ? (
          <VerticalGuide model={model} coordX={guideX} />
        ) : null}
        <div
          data-testid="rubberBand_controls"
          className={classes.rubberBandControl}
          role="presentation"
          ref={controlsRef}
          onMouseDown={mouseDown}
          onMouseOut={mouseOut}
          onMouseMove={mouseMove}
        >
          {ControlComponent}
        </div>
      </>
    )
  }

  /* Calculating Pixels for Mouse Dragging */
  const right = anchorPosition ? anchorPosition.offsetX : currentX || 0
  const left = right < startX ? right : startX
  const width = Math.abs(right - startX)
  const { views } = model
  const leftBpOffsets = views.map(view => view.pxToBp(left))
  const rightBpOffsets = views.map(view => view.pxToBp(left + width))
  const numOfBpSelected = views.map(view => Math.ceil(width * view.bpPerPx))
  return (
    <>
      {rubberBandRef.current ? (
        <>
          <Popover
            className={classes.popover}
            classes={{
              paper: classes.paper,
            }}
            open
            anchorEl={rubberBandRef.current}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            disableRestoreFocus
          >
            <Typography>{leftBpOffsets.map(stringify).join(',')}</Typography>
          </Popover>
          <Popover
            className={classes.popover}
            classes={{
              paper: classes.paper,
            }}
            open
            anchorEl={rubberBandRef.current}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            keepMounted
            disableRestoreFocus
          >
            <Typography>{rightBpOffsets.map(stringify).join(',')}</Typography>
          </Popover>
        </>
      ) : null}
      <div
        ref={rubberBandRef}
        className={classes.rubberBand}
        style={{ left, width }}
      >
        <Typography variant="h6" className={classes.rubberBandText}>
          {numOfBpSelected.map(n => `${n.toLocaleString('en-US')}bp`).join(',')}
        </Typography>
      </div>
      <div
        data-testid="rubberBand_controls"
        className={classes.rubberBandControl}
        role="presentation"
        ref={controlsRef}
        onMouseDown={mouseDown}
        onMouseOut={mouseOut}
        onMouseMove={mouseMove}
      >
        {ControlComponent}
      </div>
      {anchorPosition ? (
        <Menu
          anchorReference="anchorPosition"
          anchorPosition={{
            left: anchorPosition.clientX,
            top: anchorPosition.clientY,
          }}
          onMenuItemClick={handleMenuItemClick}
          open={open}
          onClose={handleClose}
          menuItems={model.rubberBandMenuItems()}
        />
      ) : null}
    </>
  )
}

export default observer(RubberBand)
