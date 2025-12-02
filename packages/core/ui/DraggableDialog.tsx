import { useRef } from 'react'

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
import Draggable from 'react-draggable'

import { getCloseButtonStyle } from './dialogStyles'

import type { DialogProps, PaperProps } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  closeButton: getCloseButtonStyle(theme),
}))

function PaperComponent(props: PaperProps) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <Draggable
      nodeRef={ref}
      cancel={'[class*="MuiDialogContent-root"]'}
      onStart={event => {
        const target = event.target as HTMLElement | null
        if (!`${target?.className}`.includes('MuiDialogTitle')) {
          return false
        }
      }}
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
              onClick={event => {
                onClose(event, 'escapeKeyDown')
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
