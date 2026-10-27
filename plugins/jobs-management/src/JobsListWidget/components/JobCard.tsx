import { StatusProgressBar } from '@jbrowse/core/ui'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { JobModel } from '../jobModel.ts'

const JobProgress = observer(function JobProgress({ job }: { job: JobModel }) {
  const { progressPct } = job
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 1,
      }}
    >
      {/* named, because a test looking for `[role="progressbar"]` on a
          real page finds a display's loading overlay just as readily */}
      <Box sx={{ width: '100%' }} data-testid="job-progress">
        <StatusProgressBar
          fraction={progressPct === undefined ? undefined : progressPct / 100}
        />
      </Box>
      {progressPct === undefined ? null : (
        <Box sx={{ m: 1 }}>
          <Typography>{`${Math.round(progressPct)}%`}</Typography>
        </Box>
      )}
    </Box>
  )
})

const JobCard = observer(function JobCard({ job }: { job: JobModel }) {
  const running = job.state === 'running'
  const message = job.cancelling ? 'Cancelling…' : job.statusMessage
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.label ?? job.name}
        </Typography>
        {message ? (
          <Typography variant="body1">
            <strong>{'Message: '}</strong>
            {message}
          </Typography>
        ) : null}
        {running ? <JobProgress job={job} /> : null}
      </CardContent>
      {running ? (
        <CardActions>
          <Button
            variant="contained"
            color="inherit"
            disabled={job.cancelling}
            onClick={() => {
              job.cancel()
            }}
          >
            {job.cancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        </CardActions>
      ) : null}
    </Card>
  )
})

export default JobCard
