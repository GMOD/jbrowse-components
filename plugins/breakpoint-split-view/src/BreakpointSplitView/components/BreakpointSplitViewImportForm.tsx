import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { allSessionTracks } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Container, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ImportFormRow from './ImportFormRow.tsx'
import SharedTrackSelector from './SharedTrackSelector.tsx'
import { getSharedTracks, rowsToViewInits } from './importFormUtils.ts'
import { useImportFormRows } from './useImportFormRows.ts'

import type { BreakpointViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    padding: theme.spacing(4),
  },
  section: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  button: {
    margin: theme.spacing(1),
  },
}))

const BreakpointSplitViewImportForm = observer(
  function BreakpointSplitViewImportForm({
    model,
  }: {
    model: BreakpointViewModel
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const defaultAssembly = session.assemblyNames[0] ?? ''
    const { rows, addRow, updateRow, removeRow, moveRow } =
      useImportFormRows(defaultAssembly)
    const [trackId, setTrackId] = useState('')
    const [launchError, setLaunchError] = useState<unknown>()
    const canLaunch = rows.every(r => r.assembly)
    // the launch throw first, then whatever left the opened views unusable (a
    // failed assembly, which is why the form is back up at all). The model's is
    // derived from the current views, so a re-submit clears it on its own.
    const error = launchError ?? model.error

    // A track is only launchable if it covers every selected assembly, so
    // clamp the selection to the currently shared tracks: editing a row's
    // assembly can invalidate a previously-picked track, and we must neither
    // display nor launch a stale trackId.
    const sharedTracks = getSharedTracks(
      // allSessionTracks, not session.tracks: a track from a connection can be
      // opened in every row just as well as a config one
      allSessionTracks(session),
      rows.map(r => r.assembly),
      session.assemblyManager,
    )
    const validTrackId = sharedTracks.some(t => t.trackId === trackId)
      ? trackId
      : ''

    return (
      <Container className={classes.container}>
        {error ? <ErrorBanner error={error} /> : null}
        <Typography variant="h6">
          Open a breakpoint split view comparing two or more regions
        </Typography>
        <div className={classes.section}>
          {rows.map((row, idx) => (
            <ImportFormRow
              key={row.id}
              idx={idx}
              count={rows.length}
              assembly={row.assembly}
              loc={row.loc}
              session={session}
              onAssemblyChange={val => {
                updateRow(row.id, { assembly: val })
              }}
              onLocChange={val => {
                updateRow(row.id, { loc: val })
              }}
              onRemove={() => {
                removeRow(row.id)
              }}
              onMove={delta => {
                moveRow(row.id, delta)
              }}
            />
          ))}
        </div>

        <div className={classes.section}>
          <SharedTrackSelector
            session={session}
            tracks={sharedTracks}
            value={validTrackId}
            onChange={val => {
              setTrackId(val)
            }}
          />
        </div>

        <div>
          <Button
            className={classes.button}
            variant="outlined"
            onClick={() => {
              addRow()
            }}
          >
            Add row
          </Button>
          <Button
            className={classes.button}
            variant="contained"
            color="primary"
            disabled={!canLaunch}
            onClick={() => {
              try {
                setLaunchError(undefined)
                model.setViews(rowsToViewInits(rows, validTrackId))
              } catch (e) {
                console.error(e)
                setLaunchError(e)
              }
            }}
          >
            Open
          </Button>
        </div>
      </Container>
    )
  },
)

export default BreakpointSplitViewImportForm
