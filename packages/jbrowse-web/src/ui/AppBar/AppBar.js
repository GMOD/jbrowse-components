import React from 'react'
import PropTypes from 'prop-types'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/core/styles'

import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import DropDownMenu from './DropDownMenu'

const styles = {
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
}

function MainAppBar(props) {
  const { classes, model } = props

  return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar variant="dense">
          {values(model.menus).map(menu => (
            <DropDownMenu
              key={menu.name}
              menuTitle={menu.name}
              menuItems={menu.menuItems}
              model={model}
            />
          ))}
          <div className={classes.grow} />
          <Typography variant="h6" color="inherit">
            JBrowse
          </Typography>
        </Toolbar>
      </AppBar>
    </div>
  )
}

MainAppBar.propTypes = {
  classes: PropTypes.shape({
    grow: PropTypes.shape.isRequired,
    root: PropTypes.shape.isRequired,
  }).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
  // menus: PropTypes.arrayOf(
  //   PropTypes.shape({
  //     menuTitle: PropTypes.string.isRequired,
  //     menuItems: PropTypes.arrayOf(PropTypes.string).isRequired,
  //     itemIcons: PropTypes.arrayOf(PropTypes.string),
  //   }),
  // ).isRequired,
}

export default withStyles(styles)(observer(MainAppBar))
