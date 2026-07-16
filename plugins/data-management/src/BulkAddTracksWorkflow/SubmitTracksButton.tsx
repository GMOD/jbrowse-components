import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { plural, submitBulkTracks } from './util.ts'

import type { TrackConfRow } from './buildConfigs.ts'
import type { AddTrackModel } from '../AddTrackWidget/model.ts'

const useStyles = makeStyles()(theme => ({
  submit: {
    marginTop: theme.spacing(2),
    display: 'block',
  },
}))

const SubmitTracksButton = observer(function SubmitTracksButton({
  model,
  okRows,
  customNames,
  stripExtensions,
  assembly,
}: {
  model: AddTrackModel
  okRows: TrackConfRow[]
  customNames: Record<string, string>
  stripExtensions: boolean
  assembly: string
}) {
  const { classes } = useStyles()
  return (
    <Button
      variant="contained"
      color="primary"
      className={classes.submit}
      disabled={okRows.length === 0 || !assembly}
      onClick={() => {
        try {
          submitBulkTracks({
            model,
            rows: okRows,
            customNames,
            stripExtensions,
            assembly,
          })
        } catch (e) {
          getSession(model).notifyError(`${e}`, e)
        }
      }}
    >
      Add {okRows.length} {plural(okRows.length, 'track', 'tracks')}
    </Button>
  )
})

export default SubmitTracksButton
