import React from 'react'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'

// import { SnapshotIn } from 'mobx-state-tree'
// import { JobsEntry } from './JobsListWidget'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  LinearProgress,
  Typography,
} from '@material-ui/core'
import { JobsListModel, NewJob } from '../model'

function CurrentJobCard({ job, model }: { job: NewJob; model: JobsListModel }) {
  const rootModel = getParent(model, 3)
  const { jobsManager } = rootModel
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.name}
        </Typography>
        <Typography variant="body1">
          <strong>{'Message: '}</strong>
          {job.statusMessage ? job.statusMessage : 'Indexing files'}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 10,
            marginLeft: 10,
          }}
        >
          {job.progressPct === 0 || job.progressPct === 100 ? (
            <Box sx={{ width: '100%' }}>
              <LinearProgress variant="indeterminate" />
            </Box>
          ) : (
            <>
              <Box sx={{ width: '100%' }}>
                <LinearProgress variant="determinate" value={job.progressPct} />
              </Box>
              <Box sx={{ m: 1 }}>
                <Typography>{`${Math.round(
                  job.progressPct || 0,
                )}%`}</Typography>
              </Box>
            </>
          )}
        </Box>
      </CardContent>
      <CardActions>
        <Button
          variant="contained"
          color="inherit"
          onClick={() => {
            console.log('Hello?')
            jobsManager.abortJob()
            // job.cancelCallback && job.cancelCallback()
            // model.removeJob(job.name)
          }}
        >
          Cancel
        </Button>
      </CardActions>
      {/* {job.cancelCallback() ? (
        <CardActions>
          <Button
            variant="contained"
            color="inherit"
            onClick={() => {
              console.log("Hello?")
              jobsManager.abortJob()
              // job.cancelCallback && job.cancelCallback()
              // model.removeJob(job.name)
            }}
          >
            Cancel
          </Button>
        </CardActions>
      ) : null} */}
    </Card>
  )
}

export default observer(CurrentJobCard)
