import UndoIcon from '@mui/icons-material/Undo'
import {
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'

import type { TrackConfigChange } from '../util/trackConfigDelta.ts'

const useStyles = makeStyles()(theme => ({
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

// Many config values are `{ type: 'x' }` discriminated unions (colorBy,
// groupBy, sortedBy, ...). Show just the type when that is the whole object so
// the table reads "methylation" rather than `{"type":"methylation"}`; richer
// objects keep full JSON so no detail is hidden.
function isSoleTypeObject(v: object): v is { type: string } {
  return (
    'type' in v && typeof v.type === 'string' && Object.keys(v).length === 1
  )
}

function formatSettingValue(value: unknown): string {
  return value === undefined
    ? '(default)'
    : typeof value === 'string'
      ? value
      : typeof value === 'object' && value !== null && isSoleTypeObject(value)
        ? value.type
        : JSON.stringify(value)
}

/**
 * Shared three-column diff table (Setting / Default / Current) used by both the
 * per-track "changes" dialog and the global preferences-reset dialog, so the two
 * read identically. Each row is a `TrackConfigChange` — a dotted `path` and its
 * `from` (default) / `to` (current) values. Passing `onResetRow` adds a trailing
 * per-row revert button, letting the caller reset a single entry (the
 * preferences dialog uses this so a reset need not be all-or-nothing).
 */
const SettingsChangesTable = observer(function SettingsChangesTable({
  changes,
  onResetRow,
}: {
  changes: TrackConfigChange[]
  onResetRow?: (change: TrackConfigChange) => void
}) {
  const { classes } = useStyles()
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Setting</TableCell>
          <TableCell>Default</TableCell>
          <TableCell>Current</TableCell>
          {onResetRow ? <TableCell /> : null}
        </TableRow>
      </TableHead>
      <TableBody>
        {changes.map(change => (
          <TableRow key={change.path.join('.')}>
            <TableCell className={classes.path}>
              {change.path.join(' › ')}
            </TableCell>
            <TableCell className={`${classes.value} ${classes.defaultCell}`}>
              {formatSettingValue(change.from)}
            </TableCell>
            <TableCell className={classes.value}>
              {formatSettingValue(change.to)}
            </TableCell>
            {onResetRow ? (
              <TableCell padding="none">
                <Tooltip title="Reset this preference">
                  <IconButton
                    size="small"
                    onClick={() => {
                      onResetRow(change)
                    }}
                  >
                    <UndoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
})

export default SettingsChangesTable
