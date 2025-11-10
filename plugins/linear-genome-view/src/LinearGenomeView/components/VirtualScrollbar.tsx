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
    '&::-webkit-scrollbar': { // Chrome, Safari
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
    opacity: 0.7, // Make visible by default for debugging
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
  const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * (containerHeight - thumbHeight) : 0

  // Use native event listener to avoid passive listener issues
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handleWheel = (event: WheelEvent) => {
      // Don't scroll, but prevent the event from bubbling to browser
      event.preventDefault()
      event.stopPropagation()
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const handleThumbMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      y: event.clientY,
      scrollTop,
    }
  }, [scrollTop])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !needsScrollbar) return

    event.preventDefault()
    const deltaY = event.clientY - dragStartRef.current.y
    const scrollDelta = (deltaY / (containerHeight - thumbHeight)) * (contentHeight - containerHeight)
    const maxScrollTop = contentHeight - containerHeight
    const newScrollTop = Math.max(0, Math.min(
      maxScrollTop,
      dragStartRef.current.scrollTop + scrollDelta
    ))

    console.log('Drag scroll:', {
      contentHeight,
      containerHeight,
      maxScrollTop,
      thumbHeight,
      deltaY,
      scrollDelta,
      oldScrollTop: dragStartRef.current.scrollTop,
      newScrollTop
    })

    onScroll(newScrollTop)
  }, [isDragging, needsScrollbar, containerHeight, thumbHeight, contentHeight, onScroll])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
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
        title={`ScrollTop: ${scrollTop}/${contentHeight - containerHeight}`}
      >
        {children}
      </div>

      {needsScrollbar && (
        <div
          className={`${classes.scrollbar} ${scrollbarVisible || isDragging ? classes.scrollbarVisible : ''}`}
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