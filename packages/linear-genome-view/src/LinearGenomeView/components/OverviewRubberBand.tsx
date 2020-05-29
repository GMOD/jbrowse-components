import Popover from '@material-ui/core/Popover'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect, useState } from 'react'
import { LinearGenomeViewStateModel, HEADER_OVERVIEW_HEIGHT } from '..'

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

function OverviewRubberBand({
  model,
  ControlComponent = <div />,
  scale,
  children,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
  scale: number
  children: React.ReactNode
}) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()
  const [mouseDragging, setMouseDragging] = useState(false)
  const [guideX, setGuideX] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      if (controlsRef.current) {
        const relativeX =
          event.clientX - controlsRef.current.getBoundingClientRect().left
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      setMouseDragging(false)
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.keyCode === 27) {
        setStartX(undefined)
        setCurrentX(undefined)
        setMouseDragging(false)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      window.addEventListener('keydown', globalKeyDown, true)
      cleanup = () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
        window.removeEventListener('keydown', globalKeyDown, true)
      }
    }
    return cleanup
  }, [mouseDragging])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setMouseDragging(true)
    const relativeX = event.clientX
    setStartX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!guideOpen) {
      setGuideOpen(true)
    }
    setGuideX(event.clientX)
  }

  function mouseOut() {
    zoomToRegion()
    setGuideOpen(false)
  }

  function zoomToRegion() {
    if (startX === undefined || currentX === undefined) return
    let leftPx = startX
    let rightPx = currentX
    if (rightPx < leftPx) {
      ;[leftPx, rightPx] = [rightPx, leftPx]
    }

    console.log('zooming here')
    // TODORB: get all the displayed regions in an array. Map through each one
    // find the earliest overlap between the display region and the leftpx
    // if no overlap go to next. then find the latest overlap between
    // display region and the rightpx. zoom into everything in between
  }

  const controlComponent = React.cloneElement(ControlComponent, {
    'data-testid': 'overviewRubberBand_controls',
    className: classes.rubberBandControl,
    role: 'presentation',
    ref: controlsRef,
    onMouseDown: mouseDown,
    onMouseOut: mouseOut,
    onMouseMove: mouseMove,
  })

  let left = 0
  let width = 0
  if (startX !== undefined && currentX !== undefined) {
    left = currentX < startX ? currentX : startX
    width = currentX - startX
  }

  //   const leftBpOffset = model.pxToBp(left)
  //   const leftBp = (
  //     Math.round(leftBpOffset.start + leftBpOffset.offset) + 1
  //   ).toLocaleString()
  //   const rightBpOffset = model.pxToBp(left + width)
  //   const rightBp = (
  //     Math.round(rightBpOffset.start + rightBpOffset.offset) + 1
  //   ).toLocaleString()

  const leftCount = Math.round((startX || 0) * scale)
  let leftScale = leftCount.toLocaleString()
  console.log(startX, currentX)
  let rightScale = Math.round(leftCount + width * scale).toLocaleString()
  if (leftScale > rightScale) [leftScale, rightScale] = [rightScale, leftScale]

  const isRubberBandOpen = startX !== undefined && currentX !== undefined
  return (
    <>
      <Popover
        className={classes.popover}
        classes={{
          paper: classes.paper,
        }}
        open={isRubberBandOpen}
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
        <Typography>{isRubberBandOpen ? leftScale : ''}</Typography>
      </Popover>
      <Popover
        className={classes.popover}
        classes={{
          paper: classes.paper,
        }}
        open={startX !== undefined && currentX !== undefined}
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
        <Typography>{isRubberBandOpen ? rightScale : ''}</Typography>
      </Popover>
      <div
        ref={rubberBandRef}
        className={classes.rubberBand}
        style={{ left, width: Math.abs(width), height: HEADER_OVERVIEW_HEIGHT }}
      />
      <Tooltip
        open={guideOpen && !mouseDragging}
        placement="top"
        // this conversion # will need to be changed
        // maybe Math.round(guideX / scale - 1).toLocaleString, passing scale from OverviewScaleBar
        title={Math.round(guideX * scale).toLocaleString()}
        arrow
      >
        <div
          className={classes.guide}
          style={{
            left: guideX,
          }}
        />
      </Tooltip>
      {controlComponent}
      {children}
    </>
  )
}

OverviewRubberBand.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  ControlComponent: ReactPropTypes.node,
  children: ReactPropTypes.node,
}

OverviewRubberBand.defaultProps = {
  ControlComponent: <div />,
  children: undefined,
}

export default observer(OverviewRubberBand)
