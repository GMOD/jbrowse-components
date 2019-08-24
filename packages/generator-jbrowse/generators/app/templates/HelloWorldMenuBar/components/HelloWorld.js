import { makeStyles } from '@material-ui/core'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'

const useStyles = makeStyles({
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
})

function HelloWorld({ model }) {
  const classes = useStyles()

  return (
    <AppBar className={classes.root} position="static">
      <Toolbar variant="dense">
        <Typography variant="h6" color="inherit">
          Hello, World! ({model.id})
        </Typography>
        <div className={classes.grow} />
        <Typography variant="h6" color="inherit">
          JBrowse
        </Typography>
      </Toolbar>
    </AppBar>
  )
}

HelloWorld.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(HelloWorld)
