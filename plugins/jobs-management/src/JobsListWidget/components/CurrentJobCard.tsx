import { useState } from 'react'

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
              <StatusProgressBar />
            </Box>
          ) : (
            <>
              <Box sx={{ width: '100%' }}>
                <StatusProgressBar fraction={job.progressPct / 100} />
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
            job.setStatusMessage('Cancelling…')
            job.cancelCallback()
            setClicked(true)
          }}
        >
          {clicked ? 'Cancelling…' : 'Cancel'}
        </Button>
      </CardActions>
    </Card>
  )
})

export default CurrentJobCard
