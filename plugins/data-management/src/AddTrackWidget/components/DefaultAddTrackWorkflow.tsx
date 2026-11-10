import { getNotificationSink } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isUriLocation } from '@jbrowse/core/util/types'
import { Button, Link, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { BULK_WORKFLOW } from '../workflowNames.ts'
import ConfirmTrack from './ConfirmTrack.tsx'
import TrackSourceSelect from './TrackSourceSelect.tsx'
import { doSubmit } from './doSubmit.ts'

import type { AddTrackModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    margin: theme.spacing(1),
  },
  submit: {
    alignSelf: 'flex-start',
  },
}))

function isSubmittable(model: AddTrackModel) {
  return !!(
    model.submittableTrackName &&
    model.trackType &&
    model.trackAdapter?.type &&
    model.assembly &&
    !model.mixinMissing
  )
}

const DefaultAddTrackWorkflow = observer(function DefaultAddTrackWorkflow({
  model,
  switchWorkflow,
}: {
  model: AddTrackModel
  switchWorkflow: (name: string) => void
}) {
  const { classes } = useStyles()
  const { trackData } = model
  const hasFile = isUriLocation(trackData) ? !!trackData.uri : !!trackData

  return (
    <div className={classes.root} data-testid="addTrackWorkflow">
      <Typography variant="body2" color="textSecondary">
        Have multiple files?{' '}
        <Link
          component="button"
          variant="body2"
          onClick={() => {
            switchWorkflow(BULK_WORKFLOW)
          }}
        >
          Add multiple tracks at once
        </Link>
      </Typography>
      <TrackSourceSelect model={model} />
      {hasFile ? <ConfirmTrack model={model} /> : null}
      <Button
        disabled={!hasFile || !isSubmittable(model)}
        variant="contained"
        color="primary"
        className={classes.submit}
        onClick={() => {
          try {
            doSubmit({ model })
          } catch (e) {
            getNotificationSink(model).notifyError(`${e}`, e)
          }
        }}
        data-testid="addTrackButton"
      >
        Add
      </Button>
    </div>
  )
})
export default DefaultAddTrackWorkflow
