import { Menu } from '@gmod/jbrowse-core/ui'
import Popover from '@material-ui/core/Popover'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
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

function RubberBand({
  model,
  ControlComponent = <div />,
  children,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
  children: React.ReactNode
}) {
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()
  const [mouseDragging, setMouseDragging] = useState(false)
  const [anchorPosition, setAnchorPosition] = useState<
    | {
        top: number
        left: number
      }
    | undefined
  >(undefined)
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
      const pos = { left: event.clientX, top: event.clientY }
      setAnchorPosition(pos)
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
    setGuideX(
      event.clientX -
        (event.target as HTMLDivElement).getBoundingClientRect().left,
    )
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

  const controlComponent = React.cloneElement(ControlComponent, {
    'data-testid': 'rubberBand_controls',
    className: classes.rubberBandControl,
    role: 'presentation',
    ref: controlsRef,
    onMouseDown: mouseDown,
    onMouseOut: mouseOut,
    onMouseMove: mouseMove,
  })

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
      icon: 'zoom_in',
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

  const leftBpOffset = model.pxToBp(left)
  const leftBp = (
    Math.round(leftBpOffset.start + leftBpOffset.offset) + 1
  ).toLocaleString()
  const rightBpOffset = model.pxToBp(left + width)
  const rightBp = (
    Math.round(rightBpOffset.start + rightBpOffset.offset) + 1
  ).toLocaleString()

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
      <div
        ref={rubberBandRef}
        className={classes.rubberBand}
        style={{ left, width }}
      >
        <Typography variant="h6" className={classes.rubberBandText}>
          {Math.round(width * model.bpPerPx).toLocaleString()} bp{' '}
        </Typography>
      </div>
      <Tooltip
        open={guideOpen && !mouseDragging}
        placement="top"
        title={Math.round(model.pxToBp(guideX).offset + 1).toLocaleString()}
        arrow
      >
        <div
          className={classes.guide}
          style={{
            left: guideX,
            background: guideOpen && !mouseDragging ? 'red' : undefined,
          }}
        />
      </Tooltip>
      {controlComponent}
      {children}
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
        onMenuItemClick={handleMenuItemClick}
        open={open}
        onClose={handleClose}
        menuOptions={menuOptions}
      />
    </>
  )
}

RubberBand.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  ControlComponent: ReactPropTypes.node,
  children: ReactPropTypes.node,
}

RubberBand.defaultProps = {
  ControlComponent: <div />,
  children: undefined,
}

export default observer(RubberBand)
