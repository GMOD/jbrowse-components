import { Card, CardContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { JobModel } from '../jobModel.ts'

const JobCard = observer(function JobCard({ job }: { job: JobModel }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.name}
        </Typography>
        {job.statusMessage ? (
          <Typography variant="body1">
            <strong>{'Message: '}</strong>
            {job.statusMessage}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
})

export default JobCard
