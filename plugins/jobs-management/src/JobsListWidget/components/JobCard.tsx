import React from 'react'
import { observer } from 'mobx-react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { NewJob } from '../model'

const JobCard = observer(function JobCard({ job }: { job: NewJob }) {
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
