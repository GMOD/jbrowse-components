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

import { makeStyles } from '../util/tss-react/index.ts'

import type { SnackbarMessage } from './SnackbarModel.tsx'

const useStyles = makeStyles()({
  // preserve newlines in multi-line errors (e.g. MST validation dumps) while
  // still wrapping long lines and capping height so the snackbar can't grow
  // off-screen
  message: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    maxHeight: 200,
    overflowY: 'auto',
  },
})

export default function SnackbarContents({
  onClose,
  contents,
}: {
  onClose: (_event: unknown, reason?: string) => void
  contents: SnackbarMessage
}) {
  const { classes } = useStyles()
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
        <div className={classes.message}>{contents.message}</div>
      </Alert>
    </MUISnackbar>
  )
}
