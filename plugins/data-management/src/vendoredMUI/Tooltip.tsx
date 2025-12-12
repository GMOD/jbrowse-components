import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createPortal } from 'react-dom'

interface TooltipProps {
  title: React.ReactNode
  children: React.ReactElement
}

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 10000,
  backgroundColor: 'rgba(97, 97, 97, 0.92)',
  color: '#fff',
  padding: '4px 8px',
  fontSize: '0.6875rem',
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontWeight: 500,
  lineHeight: 1.4,
  borderRadius: 4,
  maxWidth: 300,
  pointerEvents: 'none',
}

export default function Tooltip({ title, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setCoords({ x: rect.left, y: rect.bottom + 8 })
    timeoutRef.current = setTimeout(() => {
      setShow(true)
    }, 500)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setShow(false)
  }, [])

  const childProps = children.props as Record<string, unknown>
  const existingOnMouseEnter = childProps.onMouseEnter as
    | ((e: React.MouseEvent) => void)
    | undefined
  const existingOnMouseLeave = childProps.onMouseLeave as
    | ((e: React.MouseEvent) => void)
    | undefined

  const onMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      existingOnMouseEnter?.(e)
      handleMouseEnter(e)
    },
    [existingOnMouseEnter, handleMouseEnter],
  )

  const onMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      existingOnMouseLeave?.(e)
      handleMouseLeave()
    },
    [existingOnMouseLeave, handleMouseLeave],
  )

  const clonedChild = useMemo(
    () =>
      title
        ? React.cloneElement(children, { onMouseEnter, onMouseLeave } as Record<
            string,
            unknown
          >)
        : children,
    [children, title, onMouseEnter, onMouseLeave],
  )

  if (!title) {
    return children
  }

  return (
    <>
      {clonedChild}
      {show &&
        createPortal(
          <div style={{ ...tooltipStyle, left: coords.x, top: coords.y }}>
            {title}
          </div>,
          document.body,
        )}
    </>
  )
}
