import React, { useState } from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import { NewJob } from '../model'

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
