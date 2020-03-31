import { Menu } from '@gmod/jbrowse-core/ui'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
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
      // @ts-ignore
      background,
      position: 'absolute',
      zIndex: 10,
    },
    rubberBandControl: {
      cursor: 'crosshair',
      width: '100%',
      minHeight: 8,
    },
  }
})

function getOffsetX(ref: React.RefObject<HTMLDivElement>, clientX: number) {
  let offset = 0
  if (ref.current) {
    offset = ref.current.getBoundingClientRect().left
  }
  return clientX - offset
}

function RubberBand({
  model,
  ControlComponent = <div />,
  children,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
  children: React.ReactNode
}) {
  const [startX, setStartX] = useState()
  const [currentX, setCurrentX] = useState()
  const [mouseDragging, setMouseDragging] = useState(false)
  const [anchorPosition, setAnchorPosition] = useState<
    | {
        top: number
        left: number
      }
    | undefined
  >(undefined)
  const ref = useRef<HTMLDivElement>(null)
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      if (ref.current) {
        const relativeX =
          event.clientX - ref.current.getBoundingClientRect().left
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

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setMouseDragging(true)
    const relativeX =
      event.clientX -
      (event.target as HTMLDivElement).getBoundingClientRect().left
    setStartX(relativeX)
  }

  function zoomToRegion() {
    let leftPx = startX
    let rightPx = currentX
    if (rightPx < leftPx) {
      ;[leftPx, rightPx] = [rightPx, leftPx]
    }
    if (rightPx - leftPx > 3) {
      const leftOffset = model.pxToBp(getOffsetX(ref, leftPx))
      const rightOffset = model.pxToBp(getOffsetX(ref, rightPx))
      model.moveTo(leftOffset, rightOffset)
    }
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
    ref,
    onMouseDown: mouseDown,
  })

  function handleMenuItemClick(
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    callback: () => void,
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

  return (
    <>
      {startX !== undefined && currentX !== undefined ? (
        <div
          className={classes.rubberBand}
          style={
            currentX < startX
              ? { left: currentX, width: startX - currentX }
              : { left: startX, width: currentX - startX }
          }
        />
      ) : null}
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
