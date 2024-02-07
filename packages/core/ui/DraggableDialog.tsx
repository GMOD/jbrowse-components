import React, { useRef } from 'react'
import { DialogProps, ScopedCssBaseline, Portal } from '@mui/material'
import { observer } from 'mobx-react'

import {
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import Draggable from 'react-draggable'

const DraggableDialog = observer(function DraggableDialog(
  props: DialogProps & { title: string },
) {
  const { children } = props
  const ref = useRef<HTMLDivElement>(null)
  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-start',
  })
  const clientPoint = useClientPoint(context, { x: 100, y: 100 })
  const { getFloatingProps } = useInteractions([clientPoint])
  return (
    <Portal>
      <ScopedCssBaseline>
        <Draggable nodeRef={ref}>
          <div ref={ref}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              {children}
            </div>
          </div>
        </Draggable>
      </ScopedCssBaseline>
    </Portal>
  )
})

export default DraggableDialog
