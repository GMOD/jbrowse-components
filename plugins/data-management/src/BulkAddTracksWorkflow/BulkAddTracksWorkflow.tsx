import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Link, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import LocationInput from './LocationInput.tsx'
import PreviewMessages from './PreviewMessages.tsx'
import SubmitTracksButton from './SubmitTracksButton.tsx'
import TrackPreviewTable from './TrackPreviewTable.tsx'
import { locationId } from './pairLocations.ts'
import { summarizeBulkInput } from './preview.ts'
import { useBulkLocations } from './useBulkLocations.ts'
import { DEFAULT_WORKFLOW } from '../AddTrackWidget/workflowNames.ts'

import type { AddTrackModel } from '../AddTrackWidget/model.ts'

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(1),
    padding: theme.spacing(2),
  },
  section: {
    marginTop: theme.spacing(2),
  },
}))

const BulkAddTracksWorkflow = observer(function BulkAddTracksWorkflow({
  model,
  switchWorkflow,
}: {
  model: AddTrackModel
  switchWorkflow: (name: string) => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const adminMode = !!session.adminMode

  const input = useBulkLocations()
  const { locations } = input
  // Reuse the widget model's assembly derivation/action (shared with the
  // single-track flow): it resolves to the view's assembly until the user picks
  // one, and setAssembly is reactive via observer.
  const assembly = model.assembly ?? ''
  const [customNames, setCustomNames] = useState<Record<string, string>>({})
  const [timestamp] = useState(() => Date.now())

  const { pairs, rows, okRows, skippedCount, orphanIndexCount, warnings } =
    summarizeBulkInput({ locations, model, assembly, adminMode, timestamp })

  function removeRow(rowId: string) {
    const pair = pairs.find(p => locationId(p.file) === rowId)
    const dropped = new Set([rowId])
    if (pair?.index) {
      dropped.add(locationId(pair.index))
    }
    input.removeLocations(dropped)
    // Drop any edited name so a later re-add of the same URL starts fresh
    // rather than resurrecting the removed row's custom name.
    setCustomNames(prev => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  return (
    <Paper className={classes.paper}>
      <Typography variant="h6">Add multiple tracks</Typography>
      <Typography variant="body2" color="textSecondary">
        Paste a list of file URLs or drop a set of local files. Track types are
        auto-detected and index files (e.g. .bai, .tbi) are paired with their
        data file automatically.{' '}
        <Link
          component="button"
          variant="body2"
          onClick={() => {
            switchWorkflow(DEFAULT_WORKFLOW)
          }}
        >
          Add a single track instead
        </Link>
      </Typography>

      <LocationInput input={input} />

      <div className={classes.section}>
        <AssemblySelector
          session={session}
          helperText="Assembly for all added tracks"
          selected={assembly}
          onChange={arg => {
            model.setAssembly(arg)
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

      <PreviewMessages
        orphanIndexCount={orphanIndexCount}
        warnings={warnings}
        skippedCount={skippedCount}
      />

      <SubmitTracksButton
        model={model}
        okRows={okRows}
        customNames={customNames}
        assembly={assembly}
      />
    </Paper>
  )
})

export default BulkAddTracksWorkflow
