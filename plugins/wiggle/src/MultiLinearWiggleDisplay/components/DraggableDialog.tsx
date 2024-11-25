import React, { useRef } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import {
  Dialog,
  DialogTitle,
  IconButton,
  Divider,
  Paper,
  ScopedCssBaseline,
} from '@mui/material'
import { observer } from 'mobx-react'
import Draggable from 'react-draggable'
import { makeStyles } from 'tss-react/mui'
import type { DialogProps, PaperProps } from '@mui/material'

// icons

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function PaperComponent(props: PaperProps) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <Draggable
      nodeRef={ref}
      cancel={'[class*="MuiDialogContent-root"]'}
      // @ts-expect-error
      onStart={arg => arg.target?.className?.includes('MuiDialogTitle')}
    >
      <Paper ref={ref} {...props} />
    </Draggable>
  )
}

const DraggableDialog = observer(function DraggableDialog(
  props: DialogProps & { title: string },
) {
  const { classes } = useStyles()
  const { title, children, onClose } = props

  return (
    <Dialog {...props} PaperComponent={PaperComponent}>
      <ScopedCssBaseline>
        <DialogTitle style={{ cursor: 'move' }}>
          {title}
          {onClose ? (
            <IconButton
              className={classes.closeButton}
              onClick={() => {
                // @ts-expect-error
                onClose()
              }}
            >
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
        <Divider />
        {children}
      </ScopedCssBaseline>
    </Dialog>
  )
})

export default DraggableDialog
