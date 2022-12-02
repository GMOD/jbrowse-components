import React from 'react'
import {
  Dialog,
  DialogTitle,
  IconButton,
  Divider,
  DialogProps,
  ScopedCssBaseline,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

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

function JBrowseDialog(props: DialogProps & { title: string }) {
  const { classes } = useStyles()
  const { title, children, onClose } = props

  return (
    <Dialog {...props}>
      <ScopedCssBaseline>
        <DialogTitle>
          {title}
          {onClose ? (
            <IconButton
              className={classes.closeButton}
              onClick={() => {
                // @ts-ignore
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
export default observer(JBrowseDialog)
