import React from 'react'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { Button, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
  note: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  top: {
    zIndex: 1000,
  },
}))

const NoTracksActiveButton = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { hideNoTracksActive } = model
  return (
    <Paper className={classes.note}>
      {!hideNoTracksActive ? (
        <>
          <Typography>No tracks active.</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => model.activateTrackSelector()}
            className={classes.top}
            startIcon={<TrackSelectorIcon />}
          >
            Open track selector
          </Button>
        </>
      ) : (
        <div style={{ height: '48px' }} />
      )}
    </Paper>
  )
})

export default NoTracksActiveButton
