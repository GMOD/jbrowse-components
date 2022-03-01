import React, { useRef, useEffect, useState } from 'react'
import {
  Popover,
  Tooltip,
  Typography,
  makeStyles,
  alpha,
} from '@material-ui/core'
import { getSession, stringify } from '@jbrowse/core/util'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { LinearGenomeViewModel, HEADER_OVERVIEW_HEIGHT } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles(theme => {
  const { tertiary, primary } = theme.palette
  const background = tertiary
    ? alpha(tertiary.main, 0.7)
    : alpha(primary.main, 0.7)
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
      color: tertiary ? tertiary.contrastText : primary.contrastText,
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
    tooltip: {
      fontSize: '1em',
    },
  }
})

const HoverTooltip = observer(
  ({
    model,
    open,
    guideX,
    overview,
  }: {
    model: LGV
    open: boolean
    guideX: number
    overview: Base1DViewModel
  }) => {
    const classes = useStyles()
    const { cytobandOffset } = model
    const { assemblyManager } = getSession(model)

    const px = overview.pxToBp(guideX - cytobandOffset)
    const assembly = assemblyManager.get(px.assemblyName)
    const cytoband = assembly?.cytobands?.find(
      f =>
        px.coord > f.get('start') &&
        px.coord < f.get('end') &&
        px.refName === assembly.getCanonicalRefName(f.get('refName')),
    )

    return (
      <Tooltip
        open={open}
        classes={{ tooltip: classes.tooltip }}
        placement="top"
        title={[stringify(px), cytoband?.get('name')].join(' ')}
        arrow
      >
        <div
          className={classes.guide}
          style={{
            left: guideX,
          }}
        />
      </Tooltip>
    )
  },
)

function OverviewRubberBand({
  model,
  overview,
  ControlComponent = <div />,
}: {
  model: LGV
  overview: Base1DViewModel
  ControlComponent?: React.ReactElement
}) {
  const { cytobandOffset } = model
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()
  const [guideX, setGuideX] = useState<number>()
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()
  const mouseDragging = startX !== undefined

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      const ref = controlsRef.current
      if (ref && mouseDragging) {
        const relativeX = event.clientX - ref.getBoundingClientRect().left
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp() {
      if (
        controlsRef.current &&
        startX !== undefined &&
        currentX !== undefined
      ) {
        if (Math.abs(currentX - startX) > 3) {
          model.zoomToDisplayedRegions(
            overview.pxToBp(startX - cytobandOffset),
            overview.pxToBp(currentX - cytobandOffset),
          )
        }
      }
      /* handling clicking and centering at a specific Bp */
      if (
        controlsRef.current &&
        startX !== undefined &&
        currentX === undefined
      ) {
        const clickedAt = overview.pxToBp(startX - cytobandOffset)
        model.centerAt(
          Math.round(clickedAt.coord),
          clickedAt.refName,
          clickedAt.index,
        )
      }
      setStartX(undefined)
      setCurrentX(undefined)

      if (startX !== undefined) {
        setGuideX(undefined)
      }
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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
  }, [mouseDragging, currentX, startX, model, overview, cytobandOffset])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (controlsRef.current) {
      setStartX(
        event.clientX - controlsRef.current.getBoundingClientRect().left,
      )
    }
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (controlsRef.current) {
      setGuideX(
        event.clientX - controlsRef.current.getBoundingClientRect().left,
      )
    }
  }

  function mouseOut() {
    setGuideX(undefined)
  }

  if (startX === undefined) {
    return (
      <div style={{ position: 'relative' }}>
        {guideX !== undefined ? (
          <HoverTooltip
            model={model}
            open={!mouseDragging}
            overview={overview}
            guideX={guideX}
          />
        ) : null}
        <div
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
  let leftBpOffset
  let rightBpOffset
  if (startX) {
    leftBpOffset = overview.pxToBp(startX - cytobandOffset)
    rightBpOffset = overview.pxToBp(startX + width - cytobandOffset)
    if (currentX && currentX < startX) {
      ;[leftBpOffset, rightBpOffset] = [rightBpOffset, leftBpOffset]
    }
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
            disableRestoreFocus
          >
            <Typography>
              {leftBpOffset ? stringify(leftBpOffset) : ''}
            </Typography>
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
            <Typography>
              {rightBpOffset ? stringify(rightBpOffset) : ''}
            </Typography>
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
