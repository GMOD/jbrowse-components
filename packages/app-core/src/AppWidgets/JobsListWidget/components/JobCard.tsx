import { StatusProgressBar } from '@jbrowse/core/ui'
import { Box, Button, Card, CardContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { JobModel } from '../jobModel.ts'

const JobProgress = observer(function JobProgress({ job }: { job: JobModel }) {
  const { progressPct } = job
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
      {/* named, because a test looking for `[role="progressbar"]` on a
          real page finds a display's loading overlay just as readily */}
      <Box sx={{ flexGrow: 1 }} data-testid="job-progress">
        <StatusProgressBar
          label={job.label ?? job.name}
          fraction={progressPct === undefined ? undefined : progressPct / 100}
        />
      </Box>
      {progressPct === undefined ? null : (
        <Typography variant="body2">{`${Math.round(progressPct)}%`}</Typography>
      )}
    </Box>
  )
})

const JobCard = observer(function JobCard({ job }: { job: JobModel }) {
  const { state, cancelling, cancelCallback } = job
  const message = cancelling ? 'Cancelling…' : job.statusMessage
  const cancellable =
    cancelCallback !== undefined && (state === 'running' || state === 'queued')
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1" sx={{ flexGrow: 1 }}>
            {job.label ?? job.name}
          </Typography>
          {cancellable ? (
            <Button
              size="small"
              disabled={cancelling}
              onClick={() => {
                job.cancel()
              }}
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </Button>
          ) : null}
        </Box>
        {message ? (
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        ) : null}
        {state === 'running' ? <JobProgress job={job} /> : null}
      </CardContent>
    </Card>
  )
})

export default JobCard
