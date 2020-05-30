import { Menu } from '@gmod/jbrowse-core/ui'
import { useEventListener } from '@gmod/jbrowse-core/util'
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
  ({ model, coordX, open }: { model: LGV; coordX: number; open: boolean }) => {
    const classes = useStyles()
    return (
      <Tooltip
        open={open}
        placement="top"
        title={Math.round(model.pxToBp(coordX).offset + 1).toLocaleString()}
        arrow
      >
        <div
          className={classes.guide}
          style={{
            left: coordX,
            background: open ? 'red' : undefined,
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
  const [mouseDragging, setMouseDragging] = useState(false)
  const [anchorPosition, setAnchorPosition] = useState<Coord | undefined>()
  const [guideX, setGuideX] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const rubberBandRef = useRef(null)
  const classes = useStyles()

  function localMouseUp(event: MouseEvent) {
    setAnchorPosition({ left: event.clientX, top: event.clientY })
    setMouseDragging(false)
  }

  useEventListener('mousemove', (event: MouseEvent) => {
    if (controlsRef.current) {
      const relativeX =
        event.clientX - controlsRef.current.getBoundingClientRect().left
      setCurrentX(relativeX)
    }
  })

  useEventListener('mouseup', (event: MouseEvent) => {
    setAnchorPosition({ left: event.clientX, top: event.clientY })
    setMouseDragging(false)
  })
  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      if (controlsRef.current) {
        const relativeX =
          event.clientX - controlsRef.current.getBoundingClientRect().left
        setCurrentX(relativeX)
      }
    }

    function globalMouseUp(event: MouseEvent) {
      setAnchorPosition({ left: event.clientX, top: event.clientY })
      setMouseDragging(false)
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.keyCode === 27) {
        setAnchorPosition(undefined)
        setStartX(undefined)
        setCurrentX(undefined)
        setMouseDragging(false)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove)
      window.addEventListener('mouseup', globalMouseUp)
      window.addEventListener('keydown', globalKeyDown)
      cleanup = () => {
        window.removeEventListener('mousemove', globalMouseMove)
        window.removeEventListener('mouseup', globalMouseUp)
        window.removeEventListener('keydown', globalKeyDown)
      }
    }
    return cleanup
  }, [
    mouseDragging,
    setAnchorPosition,
    setMouseDragging,
    setAnchorPosition,
    setStartX,
    setCurrentX,
  ])

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
    const target = event.target as HTMLDivElement
    setGuideX(event.clientX - target.getBoundingClientRect().left)
  }

  function mouseOut() {
    setGuideOpen(false)
  }

  function zoomToRegion() {
    if (startX === undefined || currentX === undefined) {
      return
    }
    let leftPx = startX
    let rightPx = currentX
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
    setMouseDragging(false)
  }

  const open = Boolean(anchorPosition)

  function handleMenuItemClick(
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    callback: Function,
  ) {
    callback()
    handleClose()
  }

  const menuOptions = [
    {
      label: 'Zoom to region',
      icon: ZoomInIcon,
      onClick: () => {
        zoomToRegion()
        handleClose()
      },
    },
  ]

  let left = 0
  let width = 0
  if (startX !== undefined && currentX !== undefined) {
    left = currentX < startX ? currentX : startX
    width = Math.abs(currentX - startX)
  }

  const isRubberBandOpen = startX !== undefined && currentX !== undefined
  if (!isRubberBandOpen) {
    return (
      <>
        <VerticalGuide
          model={model}
          open={guideOpen && !mouseDragging}
          coordX={guideX}
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
      </>
    )
  }

  const leftBpOffset = model.pxToBp(left)
  const leftBp = (
    Math.round(leftBpOffset.start + leftBpOffset.offset) + 1
  ).toLocaleString()
  const rightBpOffset = model.pxToBp(left + width)
  const rightBp = (
    Math.round(rightBpOffset.start + rightBpOffset.offset) + 1
  ).toLocaleString()

  return (
    <>
      {rubberBandRef.current ? (
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
            <Typography>{isRubberBandOpen ? leftBp : ''}</Typography>
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
            <Typography>{isRubberBandOpen ? rightBp : ''}</Typography>
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
          menuOptions={menuOptions}
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
