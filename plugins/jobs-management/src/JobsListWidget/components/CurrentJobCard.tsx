import React, { useState } from 'react'
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
import type { NewJob } from '../model'

const CurrentJobCard = observer(function CurrentJobCard({
  job,
}: {
  job: NewJob
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
          disabled={clicked || job.progressPct === 0}
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
