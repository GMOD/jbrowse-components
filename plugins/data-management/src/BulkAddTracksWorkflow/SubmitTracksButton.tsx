import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { plural, submitBulkTracks } from './util.ts'

import type { AddTrackModel } from '../AddTrackWidget/model.ts'
import type { NamedRow } from './util.ts'

const useStyles = makeStyles()(theme => ({
  submit: {
    marginTop: theme.spacing(2),
    display: 'block',
  },
}))

const SubmitTracksButton = observer(function SubmitTracksButton({
  model,
  okNamed,
  assembly,
}: {
  model: AddTrackModel
  okNamed: NamedRow[]
  assembly: string
}) {
  const { classes } = useStyles()
  return (
    <Button
      variant="contained"
      color="primary"
      className={classes.submit}
      disabled={okNamed.length === 0 || !assembly}
      onClick={() => {
        try {
          submitBulkTracks({ model, named: okNamed, assembly })
        } catch (e) {
          getSession(model).notifyError(`${e}`, e)
        }
      }}
    >
      Add {okNamed.length} {plural(okNamed.length, 'track', 'tracks')}
    </Button>
  )
})

export default SubmitTracksButton
