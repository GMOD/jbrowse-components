import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import LocationInput from './LocationInput.tsx'
import TrackPreviewTable from './TrackPreviewTable.tsx'
import { buildTrackConfigs } from './buildConfigs.ts'
import { isIndexFile, locationId, pairLocations } from './pairLocations.ts'
import { locationWarnings, parseUrlList, submitBulkTracks } from './util.ts'

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
  const [timestamp] = useState(() => Date.now())

  // The input (textarea lines or dropped files) is the single source of truth;
  // removing a row deletes its location(s) from that input rather than tracking
  // a separate "removed" overlay.
  const locations = mode === 'remote' ? parseUrlList(text) : localLocations
  const pairs = pairLocations(locations)
  const rows = buildTrackConfigs({ pairs, model, assembly, adminMode, timestamp })
  const okRows = rows.filter(row => row.status === 'ok')
  const skippedCount = rows.length - okRows.length
  const orphanIndexCount =
    locations.filter(isIndexFile).length - pairs.filter(p => p.index).length
  const warnings = locationWarnings(locations)

  function removeRow(rowId: string) {
    const pair = pairs.find(p => locationId(p.file) === rowId)
    const dropped = new Set([rowId])
    if (pair?.index) {
      dropped.add(locationId(pair.index))
    }
    const remaining = locations.filter(loc => !dropped.has(locationId(loc)))
    if (mode === 'remote') {
      setText(remaining.map(locationId).join('\n'))
    } else {
      setLocalLocations(remaining)
    }
  }

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
        setMode={setMode}
        text={text}
        setText={setText}
        localLocations={localLocations}
        setLocalLocations={setLocalLocations}
      />

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

      {rows.length > 0 ? (
        <TrackPreviewTable
          rows={rows}
          customNames={customNames}
          setCustomNames={setCustomNames}
          onRemove={removeRow}
        />
      ) : null}

      {orphanIndexCount > 0 ? (
        <Typography variant="body2" color="textSecondary">
          {orphanIndexCount} index{' '}
          {orphanIndexCount === 1 ? 'file' : 'files'} had no matching data file
          and {orphanIndexCount === 1 ? 'was' : 'were'} ignored
        </Typography>
      ) : null}
      {warnings.map(warning => (
        <Typography key={warning} variant="body2" color="warning">
          {warning}
        </Typography>
      ))}
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
