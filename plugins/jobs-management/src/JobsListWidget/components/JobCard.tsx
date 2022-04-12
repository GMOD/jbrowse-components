import React from 'react'
import { observer } from 'mobx-react'
import { Card, CardContent, Typography } from '@material-ui/core'
import { NewJob } from '../model'

function JobCard({ job }: { job: NewJob }) {
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
