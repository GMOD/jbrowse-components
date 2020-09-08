/* eslint-disable no-console */
import Popover from '@material-ui/core/Popover'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect, useState } from 'react'
import { Base1DViewModel } from '@gmod/jbrowse-core/util/Base1DViewModel'
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

// functional component for OverviewRubberBand
function OverviewRubberBand({
  model,
  overview,
  ControlComponent = <div />,
}: {
  model: LGV
  overview: Base1DViewModel
  ControlComponent?: React.ReactElement
}) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()
  const [guideX, setGuideX] = useState<number | undefined>()
  // const [clicked, setClicked] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()
  const mouseDragging = startX !== undefined

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      console.log("globalMouseMove")
      if (controlsRef.current && mouseDragging) {
        const relativeX =
          event.clientX - controlsRef.current.getBoundingClientRect().left
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      console.log("globalMouseUp")
      console.log(startX)
      console.log(currentX)
      // console.log(controlsRef.current)
      if (
        controlsRef.current &&
        startX !== undefined &&
        currentX !== undefined
      ) {
        if (Math.abs(currentX - startX) > 3) {
          console.log(Math.abs(currentX - startX))
          model.zoomToDisplayedRegions(
            overview.pxToBp(startX),
            overview.pxToBp(currentX),
          )
        }
      }

      if (
        controlsRef.current &&
        startX !== undefined &&
        currentX === undefined
      ) {
        // const center_left = startX - 488 > 0 ? startX - 488 : 0
        // const center_right = startX + 487 < 976 ? startX + 487 : 976
        // model.zoomToDisplayedRegions(
        //   overview.pxToBp(center_left),
        //   overview.pxToBp(center_right),
        // )
        console.log(overview)
        console.log(model)
        console.log("I clicked")
        model.centerAt(leftCount, leftBpOffset.refName)
      }
      setStartX(undefined)
      setCurrentX(undefined)

      if (startX !== undefined) {
        setGuideX(undefined)
      }
    }

    function globalKeyDown(event: KeyboardEvent) {
      console.log("globalKeyDown")
      if (event.keyCode === 27) {
        setStartX(undefined)
        setCurrentX(undefined)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      window.addEventListener('keydown', globalKeyDown, true)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
        window.removeEventListener('keydown', globalKeyDown, true)
      }
    }
    return () => {}
  }, [mouseDragging, currentX, startX, model, overview])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    console.log("mouseDown")
    event.preventDefault()
    event.stopPropagation()
    console.log("controlsRef.current", controlsRef.current)
    if (controlsRef.current) {
      console.log(event.clientX)
      console.log(controlsRef.current.getBoundingClientRect().left)
      setStartX(
        event.clientX - controlsRef.current.getBoundingClientRect().left,
      )
    }
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (controlsRef.current)
      setGuideX(
        event.clientX - controlsRef.current.getBoundingClientRect().left,
      )
  }

  function mouseOut() {
    setGuideX(undefined)
  }

  // function handleClick(event: React.MouseEvent<HTMLDivElement>) {
  //   event.preventDefault();
  //   console.log(event)
  //   console.log('Hello World')
  // }

  if (startX === undefined) {
    return (
      <div style={{ position: 'relative' }}>
        {guideX !== undefined ? (
          <Tooltip
            open={!mouseDragging}
            placement="top"
            title={Math.max(
              0,
              Math.round(overview.pxToBp(guideX).offset),
            ).toLocaleString()}
            arrow
          >
            <div
              className={classes.guide}
              style={{
                left: guideX,
              }}
            />
          </Tooltip>
        ) : null}
        <div
          data-testid="rubberBand_controls"
          className={classes.rubberBandControl}
          role="presentation"
          ref={controlsRef}
          onMouseDown={mouseDown}
          onMouseOut={mouseOut}
          onMouseMove={mouseMove}
          // onClick={handleClick}
        >
          {ControlComponent}
        </div>
      </div>
    )
  }

  let left = startX || 0
  console.log("LEFT", left)
  let width = 0
  console.log("WIDTH", width)
  if (startX !== undefined && currentX !== undefined) {
    left = currentX < startX ? currentX : startX
    width = currentX - startX
    console.log(left)
    console.log(width)
  }

  // calculate the start and end bp of drag
  const leftBpOffset = overview.pxToBp(startX)
  console.log(leftBpOffset)
  const rightBpOffset = overview.pxToBp(startX + width)
  console.log(rightBpOffset)
  let leftCount = Math.max(0, Math.round(leftBpOffset.offset))
  let rightCount = Math.max(0, Math.round(rightBpOffset.offset))
  console.log(leftCount)
  console.log(rightCount)

  if (
    (leftBpOffset.refName === rightBpOffset.refName &&
      leftCount > rightCount) ||
    model.idxInParentRegion(leftBpOffset.refName) >
      model.idxInParentRegion(rightBpOffset.refName)
  ) {
    ;[leftCount, rightCount] = [rightCount, leftCount]
  }

  return (
    <div style={{ position: 'relative' }}>
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
            <Typography>{leftCount.toLocaleString()}</Typography>
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
            <Typography>{rightCount.toLocaleString()}</Typography>
          </Popover>
        </>
      ) : null}
      <div
        ref={rubberBandRef}
        className={classes.rubberBand}
        style={{
          left,
          width: Math.abs(width),
          height: HEADER_OVERVIEW_HEIGHT,
        }}
      />
      <div
        data-testid="rubberBand_controls"
        className={classes.rubberBandControl}
        role="presentation"
        ref={controlsRef}
        onMouseDown={mouseDown}
        onMouseOut={mouseOut}
        onMouseMove={mouseMove}
        // onClick={handleClick}
      >
        {ControlComponent}
      </div>
    </div>
  )
}

OverviewRubberBand.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  overview: MobxPropTypes.objectOrObservableObject.isRequired,
  ControlComponent: ReactPropTypes.node,
}

OverviewRubberBand.defaultProps = {
  ControlComponent: <div />,
}

export default observer(OverviewRubberBand)
