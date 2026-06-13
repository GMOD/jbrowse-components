import { useRef, useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Container, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ImportFormRow from './ImportFormRow.tsx'
import SharedTrackSelector from './SharedTrackSelector.tsx'
import { getSharedTracks, rowsToViewInits, swap } from './importFormUtils.ts'

import type { ImportFormRowData } from './importFormUtils.ts'
import type { BreakpointViewModel } from '../model.ts'

// Stable per-row id so React keys (and AssemblySelector's internal state) follow
// a row through reorder/remove instead of being pinned to the array index.
interface Row extends ImportFormRowData {
  id: string
}

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
    const idCounterRef = useRef(0)
    const newRow = () => ({
      id: `row-${idCounterRef.current++}`,
      assembly: defaultAssembly,
      loc: '',
    })
    const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow()])
    const [trackId, setTrackId] = useState('')
    const [error, setError] = useState<unknown>()
    const canLaunch = rows.every(r => r.assembly)

    // A track is only launchable if it covers every selected assembly, so
    // clamp the selection to the currently shared tracks: editing a row's
    // assembly can invalidate a previously-picked track, and we must neither
    // display nor launch a stale trackId.
    const sharedTracks = getSharedTracks(
      session.tracks,
      rows.map(r => r.assembly),
    )
    const validTrackId = sharedTracks.some(t => t.trackId === trackId)
      ? trackId
      : ''

    function patchRow(idx: number, patch: Partial<ImportFormRowData>) {
      setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
    }

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
                patchRow(idx, { assembly: val })
              }}
              onLocChange={val => {
                patchRow(idx, { loc: val })
              }}
              onRemove={() => {
                setRows(rows.filter((_, i) => i !== idx))
              }}
              onMove={delta => {
                setRows(swap(rows, idx, idx + delta))
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
              setRows([...rows, newRow()])
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
                setError(undefined)
                model.setViews(rowsToViewInits(rows, validTrackId))
              } catch (e) {
                console.error(e)
                setError(e)
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
