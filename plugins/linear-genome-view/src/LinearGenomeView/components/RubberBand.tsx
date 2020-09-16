import { Menu } from '@gmod/jbrowse-core/ui'
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
import configSchema from '@gmod/jbrowse-plugin-wiggle/src/LinePlotRenderer/configSchema'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => {
  // @ts-ignore
  const background = theme.palette.tertiary
    ? // prettier-ignore
      // @ts-ignore
      fade(theme.palette.tertiary.main, 0.7)
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
      // @ts-ignore
      color: theme.palette.tertiary
        ? // prettier-ignore
          // @ts-ignore
          theme.palette.tertiary.contrastText
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
    const guideInfo = model.pxToBp(coordX)
    let guideBp = 0
    if (guideInfo && guideInfo.offset) {
      guideBp = guideInfo.reversed
        ? guideInfo.end - guideInfo.offset
        : guideInfo.start + guideInfo.offset
    }
    return (
      <Tooltip
        open
        placement="top"
        title={
          guideInfo
            ? `${guideInfo.refName}
        ${Math.ceil(guideBp).toLocaleString()}`
            : `${''}`
        }
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
  }, [startX, mouseDragging])

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
    console.log(model.pxToBp(guideX))
    if (model.pxToBp(guideX)) {
      if (model.pxToBp(guideX).offset) {
        console.log("*********")
        console.log(event.clientX -
          (event.target as HTMLDivElement).getBoundingClientRect().left)
        console.log(model.pxToBp(guideX).offset)
        console.log("*********")
      }
    }
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
    // we need to handle undefined regions and reverse for horizontal flip
    console.log("leftPx" ,leftPx)
    console.log("rightPx", rightPx)
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
        {guideX !== undefined && model.pxToBp(guideX).offset ? (
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
  let left = 0
  let width = 0
  let right = 0
  right = anchorPosition ? anchorPosition.left : currentX || 0
  left = right < startX ? right : startX
  width = Math.abs(right - startX)
  right = left + width
  let leftBpOffset = model.pxToBp(left)
  let rightBpOffset = model.pxToBp(left + width)
  // setting boundaries
  if (!leftBpOffset.offset && rightBpOffset.offset) {
    left += (width * model.bpPerPx - rightBpOffset.offset) / model.bpPerPx
    leftBpOffset = model.pxToBp(left)
  }
  if (!rightBpOffset.offset && leftBpOffset.offset) {
    right -=
      (width * model.bpPerPx -
        (leftBpOffset.end - leftBpOffset.start - leftBpOffset.offset)) /
      model.bpPerPx
    rightBpOffset = model.pxToBp(right)
  }
  width = Math.abs(left - right)
  const leftBp = leftBpOffset.reversed? (Math.round(leftBpOffset.end - leftBpOffset.offset)).toLocaleString(): (Math.round(leftBpOffset.start + leftBpOffset.offset)).toLocaleString()
  const rightBp = rightBpOffset.reversed? (Math.round(rightBpOffset.start - rightBpOffset.offset)).toLocaleString(): (Math.round(rightBpOffset.start + rightBpOffset.offset)).toLocaleString()

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
          >
            <Typography>{leftBp}</Typography>
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
          >
            <Typography>{rightBp}</Typography>
          </Popover>
        </>
      ) : null}
      <div
        ref={rubberBandRef}
        className={classes.rubberBand}
        style={{ left, width }}
      >
        <Typography variant="h6" className={classes.rubberBandText}>
          {Math.round(width * model.bpPerPx).toLocaleString()} bp{' '}
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
