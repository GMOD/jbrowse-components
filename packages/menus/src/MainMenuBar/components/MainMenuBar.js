import { getSession } from '@gmod/jbrowse-core/util'
import AppBar from '@material-ui/core/AppBar'
import { withStyles } from '@material-ui/styles'
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
  const session = getSession(model)

  return (
    <AppBar className={classes.root} position="static">
      <Toolbar variant="dense">
        <Typography variant="h6" color="inherit">
          JBrowse
        </Typography>
        <div className={classes.grow} />
        {values(model.menus).map(menu => (
          <DropDownMenu
            key={menu.name}
            menuTitle={menu.name}
            menuItems={menu.menuItems}
            session={session}
          />
        ))}
      </Toolbar>
    </AppBar>
  )
}

MainMenuBar.propTypes = {
  classes: PropTypes.shape({
    grow: PropTypes.shape.isRequired,
    root: PropTypes.shape.isRequired,
  }).isRequired,
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default withStyles(styles)(observer(MainMenuBar))
