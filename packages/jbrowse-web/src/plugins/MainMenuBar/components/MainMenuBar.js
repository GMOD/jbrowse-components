import AppBar from '@material-ui/core/AppBar'
import { withStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import DropDownMenu from './DropDownMenu'

const styles = {
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
}

function MainMenuBar(props) {
  const { classes, model } = props

  return (
    <AppBar className={classes.root} position="static">
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
  )
}

MainMenuBar.propTypes = {
  classes: PropTypes.shape({
    grow: PropTypes.shape.isRequired,
    root: PropTypes.shape.isRequired,
  }).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(MainMenuBar))
