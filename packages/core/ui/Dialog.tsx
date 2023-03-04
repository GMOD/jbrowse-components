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
import { ErrorBoundary } from 'react-error-boundary'

// icons
import CloseIcon from '@mui/icons-material/Close'
// locals
import ErrorMessage from './ErrorMessage'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function DialogError({ error }: { error: unknown }) {
  return (
    <div style={{ width: 800, margin: 40 }}>
      <ErrorMessage error={error} />
    </div>
  )
}

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
                // @ts-expect-error
                onClose()
              }}
            >
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
        <Divider />

        <ErrorBoundary FallbackComponent={DialogError}>
          {children}
        </ErrorBoundary>
      </ScopedCssBaseline>
    </Dialog>
  )
}
export default observer(JBrowseDialog)
