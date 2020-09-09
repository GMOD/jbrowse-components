import React from 'react'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/core/styles'

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
