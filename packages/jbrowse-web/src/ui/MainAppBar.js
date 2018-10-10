import React from 'react'
import PropTypes from 'prop-types'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/core/styles'
import DropDownMenu from './DropDownMenu'

const styles = {
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
}

function SimpleAppBar(props) {
  const { classes, menus } = props

  return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar>
          {menus.map(menu => (
            <DropDownMenu key={menu.menuTitle} {...menu} />
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

SimpleAppBar.propTypes = {
  classes: PropTypes.shape({
    grow: PropTypes.shape.isRequired,
    root: PropTypes.shape.isRequired,
  }).isRequired,
  menus: PropTypes.arrayOf(
    PropTypes.shape({
      menuTitle: PropTypes.string.isRequired,
      menuItems: PropTypes.arrayOf(PropTypes.string).isRequired,
      itemIcons: PropTypes.arrayOf(PropTypes.string),
    }),
  ).isRequired,
}

export default withStyles(styles)(SimpleAppBar)
