import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { TrackConfigChange } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  content: {
    minWidth: 500,
  },
  value: {
    fontFamily: 'monospace',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  path: {
    fontWeight: 'bold',
  },
  defaultCell: {
    color: theme.palette.text.secondary,
  },
}))

function formatValue(value: unknown): string {
  return value === undefined
    ? '(default)'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value)
}

const TrackSettingsChangesDialog = observer(
  function TrackSettingsChangesDialog({
    changes,
    trackName,
    onReset,
    handleClose,
  }: {
    changes: TrackConfigChange[]
    trackName: string
    onReset?: () => void
    handleClose: () => void
  }) {
    const { classes } = useStyles()
    return (
      <Dialog
        open
        onClose={() => {
          handleClose()
        }}
        title={`Changes to "${trackName}"`}
        maxWidth="md"
      >
        <DialogContent className={classes.content}>
          {changes.length ? (
            <>
              <DialogContentText>
                These settings differ from the track's default configuration.
              </DialogContentText>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Setting</TableCell>
                    <TableCell>Default</TableCell>
                    <TableCell>Current</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {changes.map(change => (
                    <TableRow key={change.path.join('.')}>
                      <TableCell className={classes.path}>
                        {change.path.join(' › ')}
                      </TableCell>
                      <TableCell
                        className={`${classes.value} ${classes.defaultCell}`}
                      >
                        {formatValue(change.from)}
                      </TableCell>
                      <TableCell className={classes.value}>
                        {formatValue(change.to)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <Typography>This track has no setting changes.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {changes.length && onReset ? (
            <Button
              color="secondary"
              onClick={() => {
                onReset()
                handleClose()
              }}
            >
              Reset to default
            </Button>
          ) : null}
          <Button
            variant="contained"
            onClick={() => {
              handleClose()
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default TrackSettingsChangesDialog
