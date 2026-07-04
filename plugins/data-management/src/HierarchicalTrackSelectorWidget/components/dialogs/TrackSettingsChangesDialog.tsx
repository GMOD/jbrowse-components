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
  section: {
    marginTop: theme.spacing(2),
  },
}))

// Many config values are `{ type: 'x' }` discriminated unions (colorBy,
// groupBy, sortedBy, ...). Show just the type when that is the whole object so
// the dialog reads "methylation" rather than `{"type":"methylation"}`; richer
// objects keep full JSON so no detail is hidden.
function isSoleTypeObject(v: object): v is { type: string } {
  return (
    'type' in v && typeof v.type === 'string' && Object.keys(v).length === 1
  )
}

function formatValue(value: unknown): string {
  return value === undefined
    ? '(default)'
    : typeof value === 'string'
      ? value
      : typeof value === 'object' && value !== null && isSoleTypeObject(value)
        ? value.type
        : JSON.stringify(value)
}

const ChangesTable = observer(function ChangesTable({
  changes,
}: {
  changes: TrackConfigChange[]
}) {
  const { classes } = useStyles()
  return (
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
            <TableCell className={`${classes.value} ${classes.defaultCell}`}>
              {formatValue(change.from)}
            </TableCell>
            <TableCell className={classes.value}>
              {formatValue(change.to)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
})

// Lists both sources that make a track's effective settings differ from its
// configured defaults: per-track edits (`changes`, resettable) and settings
// imposed by a session-wide displayTypeDefault (`sessionDefaults`, clearable).
// The two are kept visually separate so a global preference never reads as an
// individual edit of this track.
const TrackSettingsChangesDialog = observer(
  function TrackSettingsChangesDialog({
    changes,
    sessionDefaults = [],
    trackName,
    onReset,
    onClearDefaults,
    handleClose,
  }: {
    changes: TrackConfigChange[]
    sessionDefaults?: TrackConfigChange[]
    trackName: string
    onReset?: () => void
    onClearDefaults?: () => void
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
                These settings were edited on this track and differ from its
                default configuration.
              </DialogContentText>
              <ChangesTable changes={changes} />
            </>
          ) : null}
          {sessionDefaults.length ? (
            <div className={classes.section}>
              <DialogContentText>
                These settings come from a session-wide default you set for all
                tracks of this type, not from an edit to this track.
              </DialogContentText>
              <ChangesTable changes={sessionDefaults} />
            </div>
          ) : null}
          {changes.length || sessionDefaults.length ? null : (
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
          {sessionDefaults.length && onClearDefaults ? (
            <Button
              color="secondary"
              onClick={() => {
                onClearDefaults()
                handleClose()
              }}
            >
              Clear session default
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
