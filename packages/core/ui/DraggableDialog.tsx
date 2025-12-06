import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import {
  Dialog,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  ScopedCssBaseline,
} from '@mui/material'
import { observer } from 'mobx-react'

import useDraggable from './useDraggable'

import type { DialogProps, PaperProps } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function PaperComponent(props: PaperProps) {
  const { ref, style, onMouseDown } = useDraggable('.MuiDialogTitle-root')
  return (
    <Paper
      ref={ref}
      {...props}
      style={{ ...props.style, ...style }}
      onMouseDown={onMouseDown}
    />
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
