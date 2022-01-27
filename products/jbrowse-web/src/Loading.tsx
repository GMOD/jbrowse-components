import React from 'react'
import { makeStyles, CircularProgress } from '@material-ui/core'

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
