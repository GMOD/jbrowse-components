import { useRef } from 'react'

import { Portal } from '@mui/material'
import Draggable from 'react-draggable'

function DraggableViewPanel({
  children,
  zIndex = 100,
}: {
  children: React.ReactNode
  zIndex?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <Portal>
      <Draggable nodeRef={ref} handle=".viewHeader">
        <div
          ref={ref}
          style={{
            position: 'fixed',
            zIndex,
            top: 100,
            left: 100,
          }}
        >
          {children}
        </div>
      </Draggable>
    </Portal>
  )
}

export default DraggableViewPanel
