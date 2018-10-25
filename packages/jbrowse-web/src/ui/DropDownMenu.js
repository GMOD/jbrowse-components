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

class DropDownMenu extends React.Component {
  state = {
    anchorEl: null,
  }

  handleToggle = event => {
    const { anchorEl } = this.state
    this.setState({ anchorEl: anchorEl ? null : event.currentTarget })
  }

  handleClose = (event, callback) => {
    const { anchorEl } = this.state
    if (anchorEl.contains(event.target)) {
      return
    }
    this.setState({ anchorEl: null })
    if (callback) callback()
  }

  render() {
    const {
      classes,
      menuTitle,
      menuItems,
      itemCallbacks,
      itemIcons,
    } = this.props
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
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          placement="bottom-start"
          transition
          disablePortal
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
                    {menuItems.map((item, i) => (
                      <MenuItem
                        key={item}
                        onClick={event =>
                          this.handleClose(event, itemCallbacks[i])
                        }
                      >
                        <ListItemIcon key={item}>
                          {itemIcons[i] ? (
                            <Icon>{itemIcons[i]}</Icon>
                          ) : (
                            <EmptyIcon key={item} />
                          )}
                        </ListItemIcon>
                        <ListItemText inset primary={item} />
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

DropDownMenu.defaultProps = {
  itemIcons: [],
}

DropDownMenu.propTypes = {
  classes: PropTypes.shape({
    root: PropTypes.shape.isRequired,
  }).isRequired,
  menuTitle: PropTypes.string.isRequired,
  menuItems: PropTypes.arrayOf(PropTypes.string).isRequired,
  itemCallbacks: PropTypes.arrayOf(PropTypes.func).isRequired,
  itemIcons: PropTypes.arrayOf(PropTypes.string),
}

export default withStyles(styles)(DropDownMenu)
