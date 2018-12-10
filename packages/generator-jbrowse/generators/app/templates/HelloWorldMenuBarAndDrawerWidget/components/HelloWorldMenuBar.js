import AppBar from '@material-ui/core/AppBar'
import Button from '@material-ui/core/Button'
import { withStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'

const styles = {
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
}

function onClick(rootModel) {
  if (!rootModel.drawerWidgets.get('id-helloworlddrawerwidget'))
    rootModel.addDrawerWidget(
      'HelloWorldDrawerWidget',
      'id-helloworlddrawerwidget',
    )
  rootModel.showDrawerWidget(
    rootModel.drawerWidgets.get('id-helloworlddrawerwidget'),
  )
}

function HelloWorld(props) {
  const { classes, model } = props
  const rootModel = getRoot(model)

  return (
    <AppBar className={classes.root} position="static">
      <Toolbar variant="dense">
        <Button onClick={() => onClick(rootModel)} color="inherit">
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
  classes: PropTypes.shape({
    grow: PropTypes.shape.isRequired,
    root: PropTypes.shape.isRequired,
  }).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(HelloWorld))
