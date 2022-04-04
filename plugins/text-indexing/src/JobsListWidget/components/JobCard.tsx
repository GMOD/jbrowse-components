import React from 'react'
import { observer } from 'mobx-react'
import { Card, CardContent, Typography } from '@material-ui/core'

interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: string
  timestamp: number
  name: string
}

function JobCard({ job }: { job: TrackTextIndexing }) {
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
