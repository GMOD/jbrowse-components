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

// Many config values are `{ type: 'x' }` discriminated unions (sortedBy,
// ...). Show just the type when that is the whole object so
// the table reads "basePair" rather than `{"type":"basePair"}`; richer
// objects keep full JSON so no detail is hidden.
function isSoleTypeObject(v: object): v is { type: string } {
  return (
    'type' in v && typeof v.type === 'string' && Object.keys(v).length === 1
  )
}

// Past this many entries a list or a map is summarised by its count and its
// first few members: a row order names every sample of a cohort, and a label
// map every one the reader renamed, and a 2,500-name cell says nothing a
// count and a glimpse do not.
const LISTED_ENTRIES = 6
// Past this many characters a string is a cluster tree's newick or a jexl
// callback, and the head is what tells them apart.
const STRING_HEAD = 80

function summarizeList(values: unknown[]): string {
  const head = values
    .slice(0, LISTED_ENTRIES)
    .map(v => (typeof v === 'string' ? v : JSON.stringify(v)))
    .join(', ')
  return `${values.length} values: ${head}, …`
}

function summarizeMap(entries: [string, unknown][]): string {
  const head = entries
    .slice(0, LISTED_ENTRIES)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ')
  return `${entries.length} entries: ${head}, …`
}

export function formatSettingValue(value: unknown): string {
  if (value === undefined) {
    return '(default)'
  }
  if (typeof value === 'string') {
    return value.length > STRING_HEAD
      ? `${value.slice(0, STRING_HEAD)}… (${value.length} characters)`
      : value
  }
  if (Array.isArray(value)) {
    return value.length > LISTED_ENTRIES
      ? summarizeList(value)
      : JSON.stringify(value)
  }
  if (typeof value === 'object' && value !== null) {
    if (isSoleTypeObject(value)) {
      return value.type
    }
    const entries = Object.entries(value)
    return entries.length > LISTED_ENTRIES
      ? summarizeMap(entries)
      : JSON.stringify(value)
  }
  return JSON.stringify(value)
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
              {change.label ?? change.path.join(' › ')}
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
