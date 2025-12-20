import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Button,
  IconButton,
  Snackbar as MUISnackbar,
} from '@mui/material'

import type { SnackbarMessage } from './SnackbarModel'

export default function SnackbarContents({
  onClose,
  contents,
}: {
  onClose: (_event: unknown, reason?: string) => void
  contents: SnackbarMessage
}) {
  return (
    <MUISnackbar
      open
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={onClose}
        action={
          contents.action ? (
            <>
              <Button
                color="inherit"
                onClick={e => {
                  contents.action?.onClick()
                  onClose(e)
                }}
              >
                {contents.action.name}
              </Button>
              <IconButton color="inherit" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </>
          ) : null
        }
        severity={contents.level || 'warning'}
      >
        {contents.message}
      </Alert>
    </MUISnackbar>
  )
}
