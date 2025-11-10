import React, { useCallback, useEffect, useRef, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  container: {
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  content: {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    // Ensure no native scrollbars appear
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE and Edge
    '&::-webkit-scrollbar': {
      // Chrome, Safari
      display: 'none',
    },
  },
  scrollbar: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 8,
    height: '100%',
    backgroundColor: theme.palette.action.hover,
    opacity: 0.7,
    transition: 'opacity 0.2s ease',
    zIndex: 1000,
    '&:hover': {
      opacity: 1,
    },
  },
  scrollbarVisible: {
    opacity: 0.9,
  },
  thumb: {
    position: 'absolute',
    right: 0,
    width: '100%',
    backgroundColor: theme.palette.action.active,
    borderRadius: 4,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.focus,
    },
  },
}))

interface VirtualScrollbarProps {
  children: React.ReactNode
  contentHeight: number
  containerHeight: number
  scrollTop: number
  onScroll: (scrollTop: number) => void
  className?: string
}

const VirtualScrollbar: React.FC<VirtualScrollbarProps> = ({
  children,
  contentHeight,
  containerHeight,
  scrollTop,
  onScroll,
  className,
}) => {
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [scrollbarVisible, setScrollbarVisible] = useState(false)
  const dragStartRef = useRef({ y: 0, scrollTop: 0 })

  // Calculate scrollbar dimensions
  const needsScrollbar = contentHeight > containerHeight
  const scrollRatio = containerHeight / contentHeight
  const thumbHeight = Math.max(20, containerHeight * scrollRatio)
  const maxScrollTop = Math.max(0, contentHeight - containerHeight)
  const thumbTop =
    maxScrollTop > 0
      ? (scrollTop / maxScrollTop) * (containerHeight - thumbHeight)
      : 0

  // Handle shift+wheel for vertical track scrolling
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handleWheel = (event: WheelEvent) => {
      // Only handle shift+wheel vertical scrolling if we have a scrollbar
      if (event.shiftKey && needsScrollbar && Math.abs(event.deltaY) > 0) {
        event.preventDefault()
        event.stopPropagation()

        const delta = event.deltaY
        const maxScrollTop = Math.max(0, contentHeight - containerHeight)
        const newScrollTop = Math.max(
          0,
          Math.min(maxScrollTop, scrollTop + delta),
        )

        onScroll(newScrollTop)
      }
      // Let all other wheel events bubble up naturally
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [needsScrollbar, contentHeight, containerHeight, scrollTop, onScroll])

  const handleThumbMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation() // Prevent this from triggering parent mousedown handlers
      setIsDragging(true)
      dragStartRef.current = {
        y: event.clientY,
        scrollTop,
      }

      // Set global flag to prevent horizontal scrolling
      document.body.setAttribute('data-virtual-scrollbar-dragging', 'true')
    },
    [scrollTop],
  )

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || !needsScrollbar) return

      event.preventDefault()
      const deltaY = event.clientY - dragStartRef.current.y
      const scrollDelta =
        (deltaY / (containerHeight - thumbHeight)) *
        (contentHeight - containerHeight)
      const maxScrollTop = contentHeight - containerHeight
      const newScrollTop = Math.max(
        0,
        Math.min(maxScrollTop, dragStartRef.current.scrollTop + scrollDelta),
      )

      onScroll(newScrollTop)
    },
    [
      isDragging,
      needsScrollbar,
      containerHeight,
      thumbHeight,
      contentHeight,
      onScroll,
    ],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    // Clear global flag to re-enable horizontal scrolling
    document.body.removeAttribute('data-virtual-scrollbar-dragging')
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        // Cleanup in case mouseup doesn't fire
        document.body.removeAttribute('data-virtual-scrollbar-dragging')
      }
    }
    return () => {}
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={containerRef}
      className={`${classes.container} ${className || ''}`}
      style={{ height: containerHeight }}
    >
      <div
        className={classes.content}
        style={{
          transform: `translateY(-${scrollTop}px)`,
          height: contentHeight,
        }}
      >
        {children}
      </div>

      {needsScrollbar && (
        <div
          className={`${classes.scrollbar} ${scrollbarVisible || isDragging ? classes.scrollbarVisible : ''}`}
          onMouseDown={event => {
            // Prevent scrollbar area clicks from triggering side scroll
            event.stopPropagation()
          }}
        >
          <div
            className={classes.thumb}
            style={{
              height: thumbHeight,
              top: thumbTop,
            }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      )}
    </div>
  )
}

export default VirtualScrollbar
