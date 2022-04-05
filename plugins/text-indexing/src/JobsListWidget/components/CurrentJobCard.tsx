import React from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { JobsEntry } from './JobsListWidget'
// import { getSession } from '@jbrowse/core/util'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  LinearProgress,
  CircularProgress,
  Typography,
} from '@material-ui/core'
import { JobsListModel } from '../model'

function CurrentJobCard({
  job,
  model,
}: {
  job: JobsEntry
  model: JobsListModel
}) {
  // const session = getSession(model)
  const rootModel = getParent(model, 3)
  const { indexingStatus, running } = rootModel
  const indexingDone = Math.round(indexingStatus) === 100
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.name}
        </Typography>
      </CardContent>
      {running ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 10,
            marginLeft: 10,
          }}
        >
          <Box sx={{ width: '80%', m: 1 }}>
            <LinearProgress variant="determinate" value={indexingStatus} />
          </Box>
          <Box sx={{ minWidth: 35 }}>
            <Typography variant="body2">{`${Math.round(
              indexingStatus,
            )}%`}</Typography>
          </Box>
        </Box>
      ) : null}
      {running && indexingDone ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 10,
            marginLeft: 10,
          }}
        >
          <Typography variant="body2">Generating metadata</Typography>
          <CircularProgress
            style={{
              marginLeft: 10,
            }}
            size={20}
            disableShrink
          />
        </Box>
      ) : null}
      {job.cancelCallback ? (
        <CardActions>
          <Button
            variant="contained"
            color="inherit"
            onClick={() => {
              job.cancelCallback && job.cancelCallback()
            }}
          >
            Cancel
          </Button>
        </CardActions>
      ) : null}
    </Card>
  )
}

export default observer(CurrentJobCard)
