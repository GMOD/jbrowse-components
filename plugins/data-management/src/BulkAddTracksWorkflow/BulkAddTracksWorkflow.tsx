import { useMemo, useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import LocationInput from './LocationInput.tsx'
import TrackPreviewTable from './TrackPreviewTable.tsx'
import { buildTrackConfigs } from './buildConfigs.ts'
import { pairLocations } from './pairLocations.ts'
import { parseUrlList, submitBulkTracks } from './util.ts'

import type { InputMode } from './util.ts'
import type { AddTrackModel } from '../AddTrackWidget/model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(1),
    padding: theme.spacing(2),
  },
  section: {
    marginTop: theme.spacing(2),
  },
  submit: {
    marginTop: theme.spacing(2),
    display: 'block',
  },
}))

const BulkAddTracksWorkflow = observer(function BulkAddTracksWorkflow({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const adminMode = !!session.adminMode

  const [mode, setMode] = useState<InputMode>('remote')
  const [text, setText] = useState('')
  const [localLocations, setLocalLocations] = useState<FileLocation[]>([])
  // assemblyOverride is set when the user explicitly picks an assembly; otherwise
  // model.assembly (reactive via observer) tracks the current view's assembly.
  const [assemblyOverride, setAssemblyOverride] = useState<string>()
  const assembly = assemblyOverride ?? model.assembly ?? ''
  const [customNames, setCustomNames] = useState<Record<string, string>>({})
  // Reset removed when inputs change so re-entered URLs reappear.
  const [removed, setRemoved] = useState(() => new Set<string>())
  const [timestamp] = useState(() => Date.now())

  const remoteLocations = useMemo(() => parseUrlList(text), [text])
  const locations = mode === 'remote' ? remoteLocations : localLocations

  const rows = useMemo(
    () =>
      buildTrackConfigs({
        pairs: pairLocations(locations),
        model,
        assembly,
        adminMode,
        timestamp,
      }),
    [locations, model, assembly, adminMode, timestamp],
  )

  const visibleRows = rows.filter(row => !removed.has(row.id))
  const okRows = visibleRows.filter(row => row.status === 'ok')
  const skippedCount = visibleRows.length - okRows.length

  return (
    <Paper className={classes.paper}>
      <Typography variant="h6">Add multiple tracks</Typography>
      <Typography variant="body2" color="textSecondary">
        Paste a list of file URLs or drop a set of local files. Track types are
        auto-detected and index files (e.g. .bai, .tbi) are paired with their
        data file automatically.
      </Typography>

      <LocationInput
        mode={mode}
        setMode={m => {
          setMode(m)
          setRemoved(new Set())
        }}
        text={text}
        setText={t => {
          setText(t)
          setRemoved(new Set())
        }}
        localLocations={localLocations}
        setLocalLocations={locs => {
          setLocalLocations(locs)
          setRemoved(new Set())
        }}
      />

      {visibleRows.length > 0 ? (
        <TrackPreviewTable
          rows={visibleRows}
          customNames={customNames}
          setCustomNames={setCustomNames}
          setRemoved={setRemoved}
        />
      ) : null}

      <div className={classes.section}>
        <AssemblySelector
          session={session}
          helperText="Assembly for all added tracks"
          selected={assembly}
          onChange={arg => {
            setAssemblyOverride(arg)
          }}
          fullWidth
        />
      </div>

      {skippedCount > 0 ? (
        <Typography variant="body2" color="error">
          {skippedCount} {skippedCount === 1 ? 'row' : 'rows'} with unrecognized
          types will not be added
        </Typography>
      ) : null}
      <Button
        variant="contained"
        color="primary"
        className={classes.submit}
        disabled={okRows.length === 0 || !assembly}
        onClick={() => {
          try {
            submitBulkTracks({ model, rows: okRows, customNames, assembly })
          } catch (e) {
            session.notifyError(`${e}`, e)
          }
        }}
      >
        Add {okRows.length} {okRows.length === 1 ? 'track' : 'tracks'}
      </Button>
    </Paper>
  )
})

export default BulkAddTracksWorkflow
