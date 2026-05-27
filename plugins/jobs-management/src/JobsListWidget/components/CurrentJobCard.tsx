import { useState } from 'react'

import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  LinearProgress,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { JobModel } from '../jobModel.ts'

const CurrentJobCard = observer(function CurrentJobCard({
  job,
}: {
  job: JobModel
}) {
  const [clicked, setClicked] = useState(false)
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body1">
          <strong>{'Name: '}</strong>
          {job.name}
        </Typography>
        <Typography variant="body1">
          <strong>{'Message: '}</strong>
          {job.statusMessage || 'No message provided'}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 1,
            marginBottom: 1,
            marginLeft: 1,
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
                <Typography>{`${Math.round(job.progressPct)}%`}</Typography>
              </Box>
            </>
          )}
        </Box>
      </CardContent>
      <CardActions>
        <Button
          variant="contained"
          color="inherit"
          disabled={clicked}
          onClick={() => {
            job.setStatusMessage('Aborted via cancel button')
            job.cancelCallback()
            setClicked(true)
          }}
        >
          Cancel
        </Button>
      </CardActions>
    </Card>
  )
})

export default CurrentJobCard
