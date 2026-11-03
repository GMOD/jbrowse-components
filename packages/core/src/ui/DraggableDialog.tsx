import { useState } from 'react'

import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import { usePointerDrag } from '../util/usePointerDrag.ts'
import Dialog from './Dialog.tsx'

import type { Props as DialogProps } from './Dialog.tsx'

const useStyles = makeStyles()({
  title: {
    cursor: 'move',
    touchAction: 'none',
  },
})

// A drag-repositionable dialog. Renders the shared Dialog so it inherits the
// content-box input fix, the error boundary and the close button, and makes
// Dialog's title bar the drag handle. `slotProps` is not offered: the paper
// slot carries the drag transform, so a caller's would be dropped rather than
// merged.
const DraggableDialog = observer(function DraggableDialog(
  props: Omit<DialogProps, 'slotProps'> & { title: string },
) {
  const { classes } = useStyles()
  const { title, ...rest } = props
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [grab, setGrab] = useState({ x: 0, y: 0 })
  const drag = usePointerDrag({
    onDragStart: event => {
      setGrab({ x: event.clientX - pos.x, y: event.clientY - pos.y })
    },
    onDrag: event => {
      setPos({ x: event.clientX - grab.x, y: event.clientY - grab.y })
    },
  })

  return (
    <Dialog
      {...rest}
      titleNode={title}
      titleProps={{
        ...drag,
        className: classes.title,
        onPointerDown: event => {
          if (
            !(event.target instanceof Element && event.target.closest('button'))
          ) {
            drag.onPointerDown(event)
          }
        },
      }}
      slotProps={{
        paper: { style: { transform: `translate(${pos.x}px, ${pos.y}px)` } },
      }}
    />
  )
})

export default DraggableDialog
