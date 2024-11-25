import React from 'react'
import ErrorIcon from '@mui/icons-material/Error'
import { Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons

const useStyles = makeStyles()(theme => ({
  error: {
    margin: theme.spacing(2),
  },
  errorHeader: {
    background: theme.palette.error.light,
    color: theme.palette.error.contrastText,
    padding: theme.spacing(2),
    textAlign: 'center',
  },
  errorMessage: {
    padding: theme.spacing(2),
  },
}))

export default function ImportError({ error }: { error: unknown }) {
  const { classes } = useStyles()
  return (
    <Paper className={classes.error}>
      <div className={classes.errorHeader}>
        <ErrorIcon color="inherit" fontSize="large" />
        <div>
          <Typography variant="h6" color="inherit" align="center">
            Import error
          </Typography>
        </div>
      </div>
      <Typography className={classes.errorMessage}>{`${error}`}</Typography>
    </Paper>
  )
}
