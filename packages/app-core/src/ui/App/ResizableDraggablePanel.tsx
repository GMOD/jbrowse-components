import { useCallback, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  container: {
    position: 'fixed',
  },
  resizeHandleRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 8,
    height: '100%',
    cursor: 'ew-resize',
  },
  resizeHandleBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: 8,
    cursor: 'ns-resize',
  },
  resizeHandleCorner: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 16,
    height: 16,
    cursor: 'nwse-resize',
  },
})

export default function ResizableDraggablePanel({
  children,
  dragHandleClassName,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 800, height: 400 },
  minWidth = 200,
  minHeight = 100,
  onResize,
  onPositionChange,
  style,
}: {
  children: React.ReactNode
  dragHandleClassName: string
  defaultPosition?: { x: number; y: number }
  defaultSize?: { width: number; height: number }
  minWidth?: number
  minHeight?: number
  onResize?: (size: { width: number; height: number }) => void
  onPositionChange?: (position: { x: number; y: number }) => void
  style?: React.CSSProperties
}) {
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(defaultPosition)
  const [size, setSize] = useState(defaultSize)

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      type: 'drag' | 'resize-right' | 'resize-bottom' | 'resize-corner',
    ) => {
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const startPos = { ...position }
      const startSize = { ...size }

      function onMouseMove(e: MouseEvent) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        if (type === 'drag') {
          const newPos = {
            x: startPos.x + dx,
            y: startPos.y + dy,
          }
          setPosition(newPos)
          onPositionChange?.(newPos)
        } else {
          const newSize = { ...startSize }
          if (type === 'resize-right' || type === 'resize-corner') {
            newSize.width = Math.max(minWidth, startSize.width + dx)
          }
          if (type === 'resize-bottom' || type === 'resize-corner') {
            newSize.height = Math.max(minHeight, startSize.height + dy)
          }
          setSize(newSize)
          onResize?.(newSize)
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [position, size, minWidth, minHeight, onResize, onPositionChange],
  )

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest(`.${dragHandleClassName}`)) {
        handleMouseDown(e, 'drag')
      }
    },
    [dragHandleClassName, handleMouseDown],
  )

  return (
    <div
      ref={containerRef}
      className={classes.container}
      style={{
        ...style,
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={handleDragStart}
    >
      {children}
      <div
        className={classes.resizeHandleRight}
        onMouseDown={e => {
          handleMouseDown(e, 'resize-right')
        }}
      />
      <div
        className={classes.resizeHandleBottom}
        onMouseDown={e => {
          handleMouseDown(e, 'resize-bottom')
        }}
      />
      <div
        className={classes.resizeHandleCorner}
        onMouseDown={e => {
          handleMouseDown(e, 'resize-corner')
        }}
      />
    </div>
  )
}
