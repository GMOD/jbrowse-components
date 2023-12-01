import React from 'react'

import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'

export default function GoogleCalendarScheduleFunction() {
  return (
    <Alert severity="info" style={{ margin: 10 }}>
      <Typography variant="h6">
        New: JBrowse 2 office hours and community meetings!
      </Typography>
      <Typography>
        Starting Fall 2023, we are offering 1-on-1 appointments with members of
        our team via Google Calendar
        <Button
          variant="contained"
          style={{ margin: 10 }}
          size="small"
          href="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2WIB6bwPtShkYDn49c-ADXvpxfa6iyaEP453Uvy-e-RDZPZF5rsbTRbRlXrWelVpSicZJQsdn5"
        >
          Schedule appointment
        </Button>
      </Typography>
      <Typography>
        We will also have community meetings where anyone can join a public
        Google Meet
      </Typography>
      <ul>
        <li>
          <a href="https://meet.google.com/uti-xsjf-xbu">
            Monthly on the third Thursday, 10am EST (North America, Europe
            friendly)
          </a>
        </li>
        <li>
          <a href="https://meet.google.com/rnq-exdt-tuz">
            Monthly on the last Tuesday, 8pm EST (Asia Pacific friendly)
          </a>
        </li>
        <li>
          <a href="https://calendar.google.com/calendar/u/2?cid=ZDgxZmE0Yjk3YjdiZTAxYThjMDAzYzNkOThkMjUyOGQ1ZWM4YzNkMzRjNjgwMmQ3YjZhOWEwYmU4NDYxZDBiM0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t">
            Add both events to your Google calendar
          </a>
        </li>
      </ul>
    </Alert>
  )
}
