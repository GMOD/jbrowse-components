import Popover from '@material-ui/core/Popover'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect, useState } from 'react'
import { Region } from '@gmod/jbrowse-core/util/types'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
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

    // need to somehow get the refname of when user starts dragging and ends dragging
    // so if user starts dragging ctgA: 40000 and ends ctgB: 3000
    // should be zoom ctgA: 40000 - 50000 and ctgB: 0 - 3000
    // start needs to check that its on ctg, end needs to check its on ctgB
    // and also both need to account for spacer if they selected on ctgB ( or any thats not the first)
    function zoomToRegion() {
      if (startX === undefined || currentX === undefined) return
      let leftPx = startX
      let rightPx = currentX
      if (rightPx < leftPx) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }

      // with two refNames, need to account for refNamespacer (2) at end
      const start = Math.round(leftPx * scale) // start dragging
      const end = Math.round(rightPx * scale) // end dragging
      let firstOverlapFound = false
      console.log(start, end)

      const pessimisticNewRegions: Region[] = [] // assumes you have not found the final overlap
      let optimisitcNewRegions: Region[] = [] // assumes you have found the final overlap

      // run through the regions
      // need to check refname still!
      model.displayedRegions.forEach((region, idx) => {
        if (doesIntersect2(start, end, region.start, region.end)) {
          let startValue = region.start
          // if first instance of overlap modify the first overlapping region's start
          if (!firstOverlapFound) {
            startValue = region.start < start ? start : region.start
            firstOverlapFound = true
          }

          // current region overlapping means previous region was not region with final overlap
          // overwrite optimistic with pessimistic
          optimisitcNewRegions = JSON.parse(
            JSON.stringify(pessimisticNewRegions),
          )
          // push region with the selected end to optimistic, assume current region is final overlap
          optimisitcNewRegions.push({
            ...region,
            start: startValue,
            end: region.end > end ? end : region.end,
          })
          pessimisticNewRegions.push({ ...region, start: startValue })
        }
        // add regions that don't overlap to pessimistic, display if overlap is found in later region
        else if (firstOverlapFound) pessimisticNewRegions.push(region)
      })

      console.log(optimisitcNewRegions)
      if (optimisitcNewRegions.length) model.navToMultiple(optimisitcNewRegions)
      setStartX(undefined)
      setCurrentX(undefined)
      setMouseDragging(false)
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
    left = currentX < startX ? currentX + offsetX : startX + offsetX
    width = currentX - startX
  }

  let leftCount = Math.max(0, Math.round((startX || 0) * scale))
  let rightCount = Math.max(0, Math.round(leftCount + width * scale))
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
