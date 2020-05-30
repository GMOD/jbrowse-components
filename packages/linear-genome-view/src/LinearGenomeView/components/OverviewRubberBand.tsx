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
  const [offsetX, setOffsetX] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      if (controlsRef.current) {
        const relativeX = event.clientX
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      if (controlsRef.current) zoomToRegion()
      setMouseDragging(false)
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.keyCode === 27) {
        setStartX(undefined)
        setCurrentX(undefined)
        setMouseDragging(false)
      }
    }

    function zoomToRegion() {
      console.log(startX, currentX)
      if (startX === undefined || currentX === undefined) return
      let leftPx = startX
      let rightPx = currentX
      if (rightPx < leftPx) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }

      console.log(leftPx, rightPx, scale)
      const newRegions = []

      model.displayedRegions.map(region => {
        console.log(region)
      })
      // TODORB: get all the displayed regions in an array. Map through each one
      // find the earliest overlap between the display region and the leftpx
      // if no overlap go to next. then find the latest overlap between
      // display region and the rightpx. zoom into everything in between
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
  }, [mouseDragging, currentX, model, scale, startX])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setMouseDragging(true)
    const relativeX =
      event.clientX -
      (event.target as HTMLDivElement).getBoundingClientRect().left
    setStartX(relativeX)
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!guideOpen) {
      setGuideOpen(true)
    }
    setOffsetX((event.target as HTMLDivElement).getBoundingClientRect().left)
    setGuideX(event.clientX)
  }

  function mouseOut() {
    setGuideOpen(false)
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
    left = startX + offsetX
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

  let leftCount = Math.round((startX || 0) * scale)
  let rightCount = Math.round(leftCount + width * scale)
  if (leftCount > rightCount) {
    ;[leftCount, rightCount] = [rightCount, leftCount]
  }

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
        <Typography>
          {isRubberBandOpen ? leftCount.toLocaleString() : ''}
        </Typography>
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
        <Typography>
          {isRubberBandOpen ? rightCount.toLocaleString() : ''}
        </Typography>
      </Popover>
      <div
        ref={rubberBandRef}
        className={classes.rubberBand}
        style={{
          left,
          width: Math.abs(width),
          height: HEADER_OVERVIEW_HEIGHT,
        }}
      />
      <Tooltip
        open={guideOpen && !mouseDragging}
        placement="top"
        title={Math.round((guideX - offsetX) * scale).toLocaleString()}
        arrow
      >
        <div
          className={classes.guide}
          style={{
            left: guideX,
          }}
          data-testid="here"
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
