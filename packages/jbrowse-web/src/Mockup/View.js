import Collapse from '@material-ui/core/Collapse'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'
import TrackSelector from './TrackSelector'
import ViewAction from './ViewAction'

const useStyles = makeStyles(theme => ({
  root: {
    paddingBottom: theme.spacing(1),
    margin: theme.spacing(1),
  },
  toolbar: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.getContrastText(theme.palette.primary.light),
    marginBottom: theme.spacing(1),
  },
  grow: {
    flexGrow: 1,
  },
}))

export default function View({ name, children }) {
  const [expanded, setExpanded] = React.useState(false)
  const classes = useStyles()

  function toggleExpanded() {
    setExpanded(!expanded)
  }

  return (
    <>
      <Paper className={classes.root} elevation={8}>
        <Toolbar className={classes.toolbar} variant="dense">
          <ViewAction onTrackSelClick={toggleExpanded} />
          <div className={classes.grow} />
          <Typography>{name}</Typography>
          <div className={classes.grow} />
        </Toolbar>
        {children}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <TrackSelector />
        </Collapse>
      </Paper>
    </>
  )
}

View.propTypes = { name: PropTypes.string, children: PropTypes.node }

View.defaultProps = { name: '', children: null }
