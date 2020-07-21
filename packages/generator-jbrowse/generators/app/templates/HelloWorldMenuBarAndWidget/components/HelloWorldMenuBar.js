import { getSession } from '@gmod/jbrowse-core/util'
import AppBar from '@material-ui/core/AppBar'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
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

function onClick(session) {
  const widget = session.addWidget(
    'HelloWorldWidget',
    'id-helloworldwidget',
  )
  session.showWidget(widget)
}

function HelloWorld({ model }) {
  const classes = useStyles()
  const session = getSession(model)

  return (
    <AppBar className={classes.root} position="static">
      <Toolbar variant="dense">
        <Button onClick={() => onClick(session)} color="inherit">
          Click Me!
        </Button>
        <Typography variant="h6" color="inherit">
          ({model.id})
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
