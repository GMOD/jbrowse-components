import React from 'react'
import {
  Dialog,
  DialogTitle,
  IconButton,
  Divider,
  DialogProps,
  Paper,
  PaperProps,
  ScopedCssBaseline,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import Draggable from 'react-draggable'

// icons
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

// draggable dialog demo https://mui.com/material-ui/react-dialog/#draggable-dialog
function PaperComponent(props: PaperProps) {
  return (
    <Draggable
      handle="#draggable-dialog-title"
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper {...props} />
    </Draggable>
  )
}

function DraggableDialog(props: DialogProps & { title: string }) {
  const { classes } = useStyles()
  const { title, children, onClose } = props

  return (
    <Dialog
      {...props}
      PaperComponent={PaperComponent}
      aria-labelledby="draggable-dialog-title" // this area is important for the draggable functionality
    >
      <ScopedCssBaseline>
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
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
}
export default observer(DraggableDialog)
