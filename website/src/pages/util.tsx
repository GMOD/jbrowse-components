import React from 'react'

import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import BrowserOnly from '@docusaurus/BrowserOnly'

// force browser only to avoid browser hydration error
// https://github.com/GMOD/jbrowse-components/issues/4310
export default function GoogleCalendarScheduleFunction() {
  return (
    <BrowserOnly>
      {() => (
        <Alert severity="info" style={{ margin: 10 }}>
          <Typography variant="h6">New: JBrowse 2 office hours!</Typography>
          <Typography>
            Starting Fall 2023, we are offering 1-on-1 appointments with members
            of our team via Google Calendar
            <Button
              variant="contained"
              style={{ margin: 10 }}
              size="small"
              href="https://calendar.app.google/1AYZkNCQNmwdY2R26"
            >
              Schedule appointment
            </Button>
          </Typography>
        </Alert>
      )}
    </BrowserOnly>
  )
}
