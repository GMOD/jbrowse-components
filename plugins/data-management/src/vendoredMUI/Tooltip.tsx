import { useState } from 'react'

import {
  FloatingPortal,
  offset,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react'

import type { CSSProperties, ReactElement, ReactNode } from 'react'

interface TooltipProps {
  title: ReactNode
  children: ReactElement
}

const tooltipStyle: CSSProperties = {
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
  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    middleware: [offset(8)],
  })

  const hover = useHover(context, { delay: { open: 500, close: 0 } })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover])

  if (!title) {
    return children
  }

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()}>
        {children}
      </span>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...tooltipStyle, ...floatingStyles }}
            {...getFloatingProps()}
          >
            {title}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
