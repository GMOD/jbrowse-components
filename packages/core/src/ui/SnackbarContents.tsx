import CloseIcon from '@mui/icons-material/Close'
// Report icon is rendered here instead of in SnackbarModel to avoid storing
// JSX in MobX observables, which causes Chrome-specific issues
// See https://github.com/GMOD/jbrowse-components/issues/5325
import Report from '@mui/icons-material/Report'
import {
  Alert,
  Button,
  IconButton,
  Snackbar as MUISnackbar,
} from '@mui/material'

import type { SnackbarMessage } from './SnackbarModel.tsx'

export default function SnackbarContents({
  onClose,
  contents,
}: {
  onClose: (_event: unknown, reason?: string) => void
  contents: SnackbarMessage
}) {
  const actionName = contents.action?.name
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
                {actionName === 'report' ? <Report /> : actionName}
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
