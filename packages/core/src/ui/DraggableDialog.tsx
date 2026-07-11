import { useEffect, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { DialogTitle, IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import Dialog, { type Props as DialogProps } from './Dialog.tsx'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  title: {
    cursor: 'move',
  },
}))

// A drag-repositionable dialog. Renders the shared Dialog so it inherits the
// content-box input fix and the error boundary, and supplies a draggable title
// bar as Dialog's `header`.
const DraggableDialog = observer(function DraggableDialog(
  props: DialogProps & { title: string },
) {
  const { classes } = useStyles()
  const { title, children, onClose, ...rest } = props
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const originRef = useRef({ mouseX: 0, mouseY: 0, x: 0, y: 0 })

  useEffect(() => {
    if (dragging) {
      function move(event: MouseEvent) {
        event.preventDefault()
        const { mouseX, mouseY, x, y } = originRef.current
        setPos({
          x: x + event.clientX - mouseX,
          y: y + event.clientY - mouseY,
        })
      }
      function up() {
        setDragging(false)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
      return () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
    }
    return undefined
  }, [dragging])

  return (
    <Dialog
      {...rest}
      onClose={onClose}
      slotProps={{
        ...props.slotProps,
        paper: {
          style: { transform: `translate(${pos.x}px, ${pos.y}px)` },
        },
      }}
      header={
        <DialogTitle
          className={classes.title}
          onMouseDown={event => {
            originRef.current = {
              mouseX: event.clientX,
              mouseY: event.clientY,
              x: pos.x,
              y: pos.y,
            }
            setDragging(true)
          }}
        >
          {title}
          {onClose ? (
            <IconButton
              className={classes.closeButton}
              onClick={event => {
                onClose(event, 'closeButtonClick')
              }}
            >
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
      }
    >
      {children}
    </Dialog>
  )
})

export default DraggableDialog
