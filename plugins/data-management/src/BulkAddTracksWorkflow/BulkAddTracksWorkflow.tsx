import { AssemblySelector, LabeledCheckbox } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Link, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { DEFAULT_WORKFLOW } from '../AddTrackWidget/workflowNames.ts'
import LocationInput from './LocationInput.tsx'
import PreviewMessages from './PreviewMessages.tsx'
import SubmitTracksButton from './SubmitTracksButton.tsx'
import TrackPreviewTable from './TrackPreviewTable.tsx'
import { bulkLocations } from './bulkLocations.ts'
import { customNames } from './customNames.ts'
import { summarizeBulkInput } from './preview.ts'
import { resolveTrackNames } from './util.ts'

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
  const input = bulkLocations(model)
  const { locations } = input
  // Reuse the widget model's assembly derivation/action (shared with the
  // single-track flow): it resolves to the view's assembly until the user picks
  // one, and setAssembly is reactive via observer.
  const assembly = model.assembly ?? ''
  const names = customNames(model)
  const { stripExtensions } = model.bulk

  const { rows, skippedCount, needsSetupCount, orphanIndexCount, warnings } =
    summarizeBulkInput({ locations, model, assembly })

  // Resolved once over every row, then filtered: collisions must be counted
  // across the whole list or the preview and the added names could disagree.
  const named = resolveTrackNames({
    rows,
    customNames: names.customNames,
    stripExtensions,
  })
  const okNamed = named.filter(({ row }) => row.status === 'ok')

  function removeRow(rowId: string) {
    const dropped = new Set([rowId])
    const indexId = rows.find(row => row.id === rowId)?.indexId
    if (indexId) {
      dropped.add(indexId)
    }
    input.removeLocations(dropped)
    names.forgetRow(rowId)
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
        <>
          <LabeledCheckbox
            checked={stripExtensions}
            onChange={val => {
              model.updateBulkInput({ stripExtensions: val })
            }}
            label="Strip file extensions from track names"
          />
          <TrackPreviewTable
            named={named}
            onRename={names.renameRow}
            onRemove={removeRow}
          />
        </>
      ) : null}

      <PreviewMessages
        orphanIndexCount={orphanIndexCount}
        warnings={warnings}
        skippedCount={skippedCount}
        needsSetupCount={needsSetupCount}
      />

      <SubmitTracksButton model={model} okNamed={okNamed} assembly={assembly} />
    </Paper>
  )
})

export default BulkAddTracksWorkflow
