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
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()
  const mouseDragging = startX !== undefined

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      if (controlsRef.current && mouseDragging) {
        const relativeX =
          event.clientX - controlsRef.current.getBoundingClientRect().left
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      if (
        controlsRef.current &&
        startX !== undefined &&
        currentX !== undefined
      ) {
        if (Math.abs(currentX - startX) > 3)
          model.zoomToDisplayedRegions(
            overview.pxToBp(startX),
            overview.pxToBp(currentX),
          )
      }
      setStartX(undefined)
      setCurrentX(undefined)

      if (startX !== undefined) {
        setGuideX(undefined)
      }
    }

    function globalKeyDown(event: KeyboardEvent) {
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
    event.preventDefault()
    event.stopPropagation()
    if (controlsRef.current)
      setStartX(
        event.clientX - controlsRef.current.getBoundingClientRect().left,
      )
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
        >
          {ControlComponent}
        </div>
      </div>
    )
  }

  let left = startX || 0
  let width = 0
  if (startX !== undefined && currentX !== undefined) {
    left = currentX < startX ? currentX : startX
    width = currentX - startX
  }

  // calculate the start and end bp of drag
  const leftBpOffset = overview.pxToBp(startX)
  const rightBpOffset = overview.pxToBp(startX + width)
  let leftCount = Math.max(0, Math.round(leftBpOffset.offset))
  let rightCount = Math.max(0, Math.round(rightBpOffset.offset))
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
