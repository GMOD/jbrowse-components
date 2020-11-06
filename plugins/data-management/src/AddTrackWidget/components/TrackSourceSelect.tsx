import { FileSelector } from '@jbrowse/core/ui'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import PropTypes from 'prop-types'
import React from 'react'
import { AddTrackModel } from '../model'

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  paper: {
    padding: theme.spacing(1),
  },
}))

function TrackSourceSelect({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <FileSelector
          name="URL"
          description=""
          location={model.trackData}
          setLocation={model.setTrackData}
        />
        <FileSelector
          name="Index URL (optional)"
          description="Automatically inferred from the URL if not supplied"
          location={model.indexTrackData}
          setLocation={model.setIndexTrackData}
        />
      </Paper>
    </div>
  )
}

TrackSourceSelect.propTypes = {
  trackData: PropTypes.objectOf(PropTypes.any).isRequired,
  indexTrackData: PropTypes.objectOf(PropTypes.any).isRequired,
  setTrackData: PropTypes.func.isRequired,
  setIndexTrackData: PropTypes.func.isRequired,
}

export default TrackSourceSelect
