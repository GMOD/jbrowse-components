import { Menu } from '@jbrowse/core/ui'
import { stringify } from '@jbrowse/core/util'
import Popover from '@material-ui/core/Popover'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import ZoomInIcon from '@material-ui/icons/ZoomIn'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect, useState } from 'react'
import { LinearGenomeViewStateModel } from '..'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => {
  const background = theme.palette.tertiary
    ? fade(theme.palette.tertiary.main, 0.7)
    : fade(theme.palette.primary.main, 0.7)
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
  ({ model, coordX }: { model: LGV; coordX: number }) => {
    const classes = useStyles()
    return (
      <Tooltip
        open
        placement="top"
        title={stringify(model.pxToBp(coordX))}
        arrow
      >
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

interface Coord {
  left: number
  top: number
}

function RubberBand({
  model,
  ControlComponent = <div />,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
}) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()
  const [anchorPosition, setAnchorPosition] = useState<Coord>()
  const [guideX, setGuideX] = useState<number | undefined>()
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()
  const mouseDragging = startX !== undefined && anchorPosition === undefined

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      if (controlsRef.current && mouseDragging) {
        const relativeX =
          event.clientX - controlsRef.current.getBoundingClientRect().left
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      if (startX !== undefined) {
        setAnchorPosition({ left: event.clientX, top: event.clientY })
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
  }, [startX, mouseDragging, anchorPosition])

  useEffect(() => {
    if (
      !mouseDragging &&
      currentX !== undefined &&
      startX !== undefined &&
      Math.abs(currentX - startX) <= 3
    ) {
      handleClose()
    }
  })

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
  }

  function zoomToRegion() {
    if (startX === undefined || anchorPosition === undefined) {
      return
    }
    let leftPx = startX
    let rightPx = anchorPosition.left
    if (rightPx < leftPx) {
      ;[leftPx, rightPx] = [rightPx, leftPx]
    }
    const leftOffset = model.pxToBp(leftPx)
    const rightOffset = model.pxToBp(rightPx)
    model.moveTo(leftOffset, rightOffset)
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

  const menuItems = [
    {
      label: 'Zoom to region',
      icon: ZoomInIcon,
      onClick: () => {
        zoomToRegion()
        handleClose()
      },
    },
  ]

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
  const right = anchorPosition ? anchorPosition.left : currentX || 0
  const left = right < startX ? right : startX
  const width = Math.abs(right - startX)
  const leftBpOffset = model.pxToBp(left)
  const rightBpOffset = model.pxToBp(left + width)
  const numOfBpSelected = Math.round(width * model.bpPerPx)

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
            <Typography>{stringify(leftBpOffset)}</Typography>
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
            <Typography>{stringify(rightBpOffset)}</Typography>
          </Popover>
        </>
      ) : null}
      <div
        ref={rubberBandRef}
        className={classes.rubberBand}
        style={{ left, width }}
      >
        <Typography variant="h6" className={classes.rubberBandText}>
          {numOfBpSelected.toLocaleString('en-US')} bp
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
          anchorPosition={anchorPosition}
          onMenuItemClick={handleMenuItemClick}
          open={open}
          onClose={handleClose}
          menuItems={menuItems}
        />
      ) : null}
    </>
  )
}

RubberBand.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  ControlComponent: ReactPropTypes.node,
}

RubberBand.defaultProps = {
  ControlComponent: <div />,
}

export default observer(RubberBand)
