import { FileSelector } from '@jbrowse/core/ui'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import PropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  paper: {
    padding: theme.spacing(1),
  },
}))

function TrackSourceSelect({
  indexTrackData,
  setIndexTrackData,
  trackData,
  setTrackData,
}) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <FileSelector
          name="URL"
          description=""
          location={trackData}
          setLocation={setTrackData}
        />
        <FileSelector
          name="Index URL (optional)"
          description="Automatically inferred from the URL if not supplied"
          location={indexTrackData}
          setLocation={setIndexTrackData}
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
