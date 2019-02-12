import React from 'react'
import PropTypes from 'prop-types'
import Button from '@material-ui/core/Button'
import ClickAwayListener from '@material-ui/core/ClickAwayListener'
import Grow from '@material-ui/core/Grow'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import MenuItem from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'
import Paper from '@material-ui/core/Paper'
import Popper from '@material-ui/core/Popper'
import { withStyles } from '@material-ui/core/styles'

import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'

const styles = theme => ({
  root: {
    display: 'flex',
  },
  popper: {
    zIndex: theme.zIndex.drawer + 50,
  },
})

class DropDownMenu extends React.Component {
  static propTypes = {
    classes: PropTypes.shape({
      root: PropTypes.shape.isRequired,
    }).isRequired,
    menuTitle: PropTypes.string.isRequired,
    menuItems: MobxPropTypes.observableArray.isRequired,
    model: MobxPropTypes.observableObject.isRequired,
  }

  state = {
    anchorEl: null,
  }

  handleToggle = event => {
    const { anchorEl } = this.state
    this.setState({ anchorEl: anchorEl ? null : event.currentTarget })
  }

  handleClose = (event, callback) => {
    const { anchorEl } = this.state
    const { model } = this.props
    if (anchorEl && anchorEl.contains(event.target)) return
    this.setState({ anchorEl: null })
    if (callback) callback(model)
  }

  render() {
    const { classes, menuTitle, menuItems } = this.props
    const { anchorEl } = this.state

    return (
      <div className={classes.root}>
        <Button
          aria-owns={anchorEl ? 'menu-list-grow' : null}
          aria-haspopup="true"
          onClick={this.handleToggle}
          color="inherit"
        >
          {menuTitle}
          <Icon>arrow_drop_down</Icon>
        </Button>
        <Popper
          className={classes.popper}
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          placement="bottom-start"
          transition
          // disablePortal
        >
          {({ TransitionProps }) => (
            <Grow
              {...TransitionProps}
              id="menu-list-grow"
              style={{
                transformOrigin: 'left top',
              }}
            >
              <Paper>
                <ClickAwayListener onClickAway={this.handleClose}>
                  <MenuList>
                    {values(menuItems).map(menuItem => (
                      <MenuItem
                        key={menuItem.name}
                        onClick={event =>
                          this.handleClose(event, menuItem.func)
                        }
                      >
                        {menuItem.icon ? (
                          <ListItemIcon key={menuItem.name}>
                            <Icon>{menuItem.icon}</Icon>
                          </ListItemIcon>
                        ) : null}
                        <ListItemText
                          inset={!menuItem.icon}
                          primary={menuItem.name}
                        />
                      </MenuItem>
                    ))}
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </div>
    )
  }
}

export default withStyles(styles)(observer(DropDownMenu))
