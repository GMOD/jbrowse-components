import React from 'react'
import { CircularProgress } from '@mui/material'
import { makeStyles } from '@mui/styles'

const useStyles = makeStyles({
  loadingIndicator: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
})

export default function Loading() {
  const classes = useStyles()
  return (
    <CircularProgress
      disableShrink
      className={classes.loadingIndicator}
      size={50}
    />
  )
}
