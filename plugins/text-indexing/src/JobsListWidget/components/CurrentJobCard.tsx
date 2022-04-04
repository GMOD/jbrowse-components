import React from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Typography,
} from '@material-ui/core'
import { JobsListModel } from '../model'

interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: string
  timestamp: number
  name: string
}

function CurrentJobCard({
  job,
  model,
}: {
  job: TrackTextIndexing
  model: JobsListModel
}) {
  const session = getSession(model)
  const rootModel = getParent(model, 3)
  const { indexingStatus, running } = rootModel
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.name}
        </Typography>
      </CardContent>
      <Typography>{`${indexingStatus}%`}</Typography>
      <CardActions>
        <Button
          variant="contained"
          color="inherit"
          onClick={() => {
            console.log('this should cancel the job')
          }}
        >
          Cancel
        </Button>
      </CardActions>
    </Card>
  )
}

export default observer(CurrentJobCard)
