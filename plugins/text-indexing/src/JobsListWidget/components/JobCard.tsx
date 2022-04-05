import React from 'react'
import { observer } from 'mobx-react'
import { Card, CardContent, Typography } from '@material-ui/core'
import { JobsEntry } from './JobsListWidget'

function JobCard({ job }: { job: JobsEntry }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.name}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default observer(JobCard)
