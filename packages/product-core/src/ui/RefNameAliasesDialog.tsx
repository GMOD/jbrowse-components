import { useState } from 'react'

import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContent, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const MAX_ROWS = 10_000
const MAX_NAME_COLUMN = 30

const useStyles = makeStyles()(theme => ({
  container: {
    minWidth: 800,
  },
  rows: {
    maxHeight: 300,
    overflow: 'auto',
    background: theme.palette.background.default,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
}))

// what the copy button puts on the clipboard: tab-separated, so it pastes into
// a spreadsheet as two columns
export function formatRows(rows: [string, string[]][]) {
  return rows
    .map(([refName, names]) => `${refName}\t${names.slice(1).join(', ')}`)
    .join('\n')
}

// what the dialog shows. A tab is 8 columns wide in a <pre>, so an assembly
// whose names straddle that (hg38's `chr7` and `chr7_GL383534v2_alt`) reads as
// two ragged columns; padding to the widest name on screen is one. Capped, or
// a single 60-character GenArk contig indents every alias off the right edge
export function alignRows(rows: [string, string[]][]) {
  let width = 0
  for (const [refName] of rows) {
    width = Math.max(width, refName.length)
  }
  const pad = Math.min(width, MAX_NAME_COLUMN)
  return rows
    .map(
      ([refName, names]) =>
        `${refName.padEnd(pad)}  ${names.slice(1).join(', ')}`,
    )
    .join('\n')
}

const RefNameAliasesDialog = observer(function RefNameAliasesDialog({
  assemblyName,
  session,
  onClose,
}: {
  assemblyName: string
  session: AbstractSessionModel
  onClose: () => void
}) {
  const { classes } = useStyles()
  const [filter, setFilter] = useState('')
  const assembly = session.assemblyManager.get(assemblyName)
  // reading this is also what starts the load: assembly.afterAttach kicks
  // load() when refNameAliases is first observed, so the dialog fills in for an
  // assembly nothing has looked at yet instead of showing an empty table
  const names = assembly?.namesByCanonicalRefName
  const query = filter.toLowerCase()
  const rows = names
    ? [...names].filter(([, group]) =>
        group.some(name => name.toLowerCase().includes(query)),
      )
    : []
  const truncated = rows.length > MAX_ROWS

  return (
    <Dialog
      open
      title={`Reference name aliases for ${assemblyName}`}
      onClose={() => {
        onClose()
      }}
      maxWidth="xl"
    >
      <DialogContent className={classes.container}>
        {assembly?.error ? (
          <ErrorBanner error={assembly.error} />
        ) : !assembly ? (
          // a name the manager has no model for is not a load in flight, and
          // spinning on it is the failure RefNameInfoDialog beside this one was
          // fixed for: an assembly removed from the session while its reference
          // sequence track was open reaches here
          <Typography>
            No assembly named {assemblyName} is loaded in this session
          </Typography>
        ) : !names ? (
          <LoadingEllipses message="Loading assembly" />
        ) : (
          <>
            <div className={classes.header}>
              <TextField
                label="Filter"
                helperText="Matches a reference name or any of its aliases"
                value={filter}
                onChange={event => {
                  setFilter(event.target.value)
                }}
              />
              {/* copies what the filter left, which is what makes looking one
                  refName up and pasting it somewhere a two-click operation */}
              <CopyToClipboardButton
                variant="contained"
                value={() => formatRows(rows)}
              >
                Copy ref name aliases
              </CopyToClipboardButton>
            </div>
            <pre className={classes.rows}>
              {alignRows(truncated ? rows.slice(0, MAX_ROWS) : rows)}
            </pre>
            {truncated ? (
              <Typography variant="caption">
                Showing the first {MAX_ROWS} of {rows.length} reference names;
                filter, or use the copy button, for the rest
              </Typography>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
})

export default RefNameAliasesDialog
