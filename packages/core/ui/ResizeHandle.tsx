import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import React, { useEffect, useState } from 'react'

const useStyles = makeStyles({
  horizontalHandle: {
    cursor: 'row-resize',
    width: '100%',
  },
  verticalHandle: {
    cursor: 'col-resize',
    height: '100%',
  },
  flexbox_verticalHandle: {
    cursor: 'col-resize',
    alignSelf: 'stretch', // the height: 100% is actually unable to function inside flexbox
  },
  flexbox_horizontalHandle: {
    cursor: 'row-resize',
    alignSelf: 'stretch', // similar to above
  },
})

interface ResizeHandleProps {
  onDrag: (arg: number) => number
  vertical?: boolean
  flexbox?: boolean
  className?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [props: string]: any
}

function ResizeHandle({
  onDrag,
  vertical = false,
  flexbox = false,
  className: originalClassName,
  ...props
}: ResizeHandleProps) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const [prevPos, setPrevPos] = useState(0)
  const classes = useStyles()

  useEffect(() => {
    let cleanup = () => {}

    function mouseMove(event: MouseEvent) {
      event.preventDefault()
      const pos = event[vertical ? 'clientX' : 'clientY']
      const distance = pos - prevPos
      if (distance) {
        const actualDistance = onDrag(distance)
        setPrevPos(prevState => prevState + actualDistance)
      }
    }

    function mouseUp() {
      setMouseDragging(false)
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', mouseMove, true)
      window.addEventListener('mouseup', mouseUp, true)
      cleanup = () => {
        window.removeEventListener('mousemove', mouseMove, true)
        window.removeEventListener('mouseup', mouseUp, true)
      }
    }
    return cleanup
  }, [mouseDragging, onDrag, prevPos, vertical])

  function mouseDown(event: React.MouseEvent) {
    event.stopPropagation()
    const pos = event[vertical ? 'clientX' : 'clientY']
    setPrevPos(pos)
    setMouseDragging(true)
  }

  function mouseLeave(event: React.MouseEvent) {
    event.preventDefault()
  }

  let className
  if (flexbox) {
    if (vertical) {
      className = classes.flexbox_verticalHandle
    } else {
      className = classes.flexbox_horizontalHandle
    }
  } else if (vertical) {
    className = classes.verticalHandle
  } else {
    className = classes.horizontalHandle
  }

  return (
    <div
      onMouseDown={mouseDown}
      onMouseLeave={mouseLeave}
      role="presentation"
      className={clsx(className, originalClassName)}
      {...props}
    />
  )
}

export default ResizeHandle
