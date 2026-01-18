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
  const { actions } = contents
  return (
    <MUISnackbar
      open
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={onClose}
        action={
          actions?.length ? (
            <>
              {actions.map((action, idx) => (
                <Button
                  key={idx}
                  color="inherit"
                  onClick={e => {
                    action.onClick()
                    onClose(e)
                  }}
                >
                  {action.name === 'report' ? <Report /> : action.name}
                </Button>
              ))}
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
