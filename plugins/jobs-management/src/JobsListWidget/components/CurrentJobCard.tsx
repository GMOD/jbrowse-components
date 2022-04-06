import React from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { JobsEntry } from './JobsListWidget'
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
  const rootModel = getParent(model, 3)
  const { jobsManager } = rootModel
  const { status, running, statusMessage } = jobsManager
  const indexingDone = Math.round(status) === 100
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.name}
        </Typography>
        {running ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 10,
              marginLeft: 10,
            }}
          >
            <Box sx={{ width: '40%' }}>
              <Typography variant="body2">Indexing files</Typography>
            </Box>
            <Box sx={{ width: '100%' }}>
              <LinearProgress variant="determinate" value={status} />
            </Box>
            <Box sx={{ m: 1 }}>
              <Typography>{`${Math.round(status)}%`}</Typography>
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
              marginRight: 10,
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2">{statusMessage}</Typography>
            </Box>
            <Box sx={{ m: 1 }}>
              <CircularProgress size={10} disableShrink />
            </Box>
          </Box>
        ) : null}
      </CardContent>
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
