/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { observer } from 'mobx-react'
import ScopedCssBaseline from '@material-ui/core/ScopedCssBaseline'
import {
  Dialog,
  DialogTitle,
  IconButton,
  Divider,
  DialogProps,
  makeStyles,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function JBrowseDialog(props: DialogProps & { title: string }) {
  const classes = useStyles()
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
                //@ts-ignore
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
