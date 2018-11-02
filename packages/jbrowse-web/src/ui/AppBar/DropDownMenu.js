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
import SvgIcon from '@material-ui/core/SvgIcon'
import { withStyles } from '@material-ui/core/styles'

import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'

function EmptyIcon(props) {
  return (
    <SvgIcon {...props}>
      <path />
    </SvgIcon>
  )
}

const styles = {
  root: {
    display: 'flex',
  },
}

@observer
class DropDownMenu extends React.Component {
  state = {
    anchorEl: null,
    extraElement: null,
  }

  handleToggle = event => {
    const { anchorEl } = this.state
    this.setState({ anchorEl: anchorEl ? null : event.currentTarget })
  }

  handleClose = (event, callback) => {
    const { anchorEl } = this.state
    const { store } = this.props
    if (anchorEl.contains(event.target)) {
      return
    }
    this.setState({ anchorEl: null })
    if (callback) callback(store)
  }

  render() {
    const { classes, menuTitle, menuItems } = this.props
    const { anchorEl, extraElement } = this.state

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
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          placement="bottom-start"
          transition
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
                        <ListItemIcon key={menuItem.name}>
                          {menuItem.icon ? (
                            <Icon>{menuItem.icon}</Icon>
                          ) : (
                            <EmptyIcon key={menuItem.name} />
                          )}
                        </ListItemIcon>
                        <ListItemText inset primary={menuItem.name} />
                      </MenuItem>
                    ))}
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
        {extraElement}
      </div>
    )
  }
}

DropDownMenu.defaultProps = {
  itemIcons: [],
}

DropDownMenu.propTypes = {
  classes: PropTypes.shape({
    root: PropTypes.shape.isRequired,
  }).isRequired,
  menuTitle: PropTypes.string.isRequired,
  menuItems: MobxPropTypes.observableArray.isRequired,
  store: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(DropDownMenu)
