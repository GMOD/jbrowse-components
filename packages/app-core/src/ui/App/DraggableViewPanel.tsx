import React, { useRef } from 'react'
import { Portal } from '@mui/material'
import { observer } from 'mobx-react'

import {
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import Draggable, { DraggableEventHandler } from 'react-draggable'

const DraggableViewPanel = observer(function DraggableViewPanel({
  children,
  zIndex = 100,
  onStop,
}: {
  children: React.ReactNode
  zIndex?: number
  x?: number
  y?: number
  onStop?: DraggableEventHandler
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-start',
  })
  const clientPoint = useClientPoint(context, { x: 100, y: 100 })
  const { getFloatingProps } = useInteractions([clientPoint])
  return (
    <Portal>
      <Draggable nodeRef={ref} handle=".viewHeader" onStop={onStop}>
        <div
          ref={ref}
          style={{
            position: 'fixed',
            zIndex,
          }}
        >
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {children}
          </div>
        </div>
      </Draggable>
    </Portal>
  )
})

export default DraggableViewPanel
