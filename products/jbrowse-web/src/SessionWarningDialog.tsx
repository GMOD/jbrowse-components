import React from 'react'
import { makeStyles } from '@mui/styles'
import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
} from '@mui/material'
import WarningIcon from '@mui/icons-material/Warning'
import { Theme } from '@mui/material/styles'

const useStyles = makeStyles((theme: Theme) => ({
  main: {
    textAlign: 'center',
    margin: 8, // theme.spacing(2),
    padding: 8, // theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
  },
  buttons: {
    margin: 8, // theme.spacing(2),
    color: theme.palette.text.primary,
  },
}))

export default function SessionWarningModal({
  onConfirm,
  onCancel,
  reason,
}: {
  onConfirm: () => void
  onCancel: () => void
  reason: { url: string }[]
}) {
  const classes = useStyles()
  return (
    <Dialog
      open
      maxWidth="xl"
      data-testid="session-warning-modal"
      className={classes.main}
    >
      <DialogTitle>Warning</DialogTitle>
      <Divider />
      <div>
        <WarningIcon fontSize="large" />
        <DialogContent>
          <DialogContentText>
            This link contains a session that has the following unknown plugins:
            <ul>
              {reason.map(r => (
                <li key={JSON.stringify(r)}>URL: {r.url}</li>
              ))}
            </ul>
            Please ensure you trust the source of this session.
          </DialogContentText>
        </DialogContent>
        <div className={classes.buttons}>
          <Button
            color="primary"
            variant="contained"
            style={{ marginRight: 5 }}
            onClick={async () => {
              onConfirm()
            }}
          >
            Yes, I trust it
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              onCancel()
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
