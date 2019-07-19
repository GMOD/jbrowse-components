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
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import PropTypes from 'prop-types'
import React, { useState } from 'react'

const styles = theme => ({
  root: {
    display: 'flex',
  },
  popper: {
    zIndex: theme.zIndex.drawer + 50,
  },
  grow: {
    transformOrigin: 'left top',
  },
})

function DropDownMenu(props) {
  const [open, setOpen] = useState(false)
  const anchorEl = React.useRef(null)

  const { classes, menuTitle, menuItems, session } = props

  function handleToggle() {
    setOpen(!open)
  }

  function handleClose(event, callback) {
    if (anchorEl.current.contains(event.target)) {
      return
    }

    setOpen(false)
    if (callback) callback(session)
  }

  return (
    <div className={classes.root}>
      <Button
        buttonRef={anchorEl}
        aria-owns={anchorEl ? 'menu-list-grow' : null}
        aria-haspopup="true"
        onClick={handleToggle}
        color="inherit"
        data-testid="dropDownMenuButton"
      >
        {menuTitle}
        <Icon>arrow_drop_down</Icon>
      </Button>
      <Popper
        className={classes.popper}
        open={open}
        anchorEl={anchorEl.current}
        placement="bottom-start"
        transition
        // disablePortal
      >
        {({ TransitionProps }) => (
          <Grow
            {...TransitionProps}
            id="menu-list-grow"
            className={classes.grow}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList>
                  {values(menuItems).map(menuItem => (
                    <MenuItem
                      key={menuItem.name}
                      onClick={event => handleClose(event, menuItem.func)}
                      data-testid="menuItemId"
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

DropDownMenu.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  menuTitle: PropTypes.string.isRequired,
  menuItems: MobxPropTypes.observableArray.isRequired,
  session: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default withStyles(styles)(observer(DropDownMenu))
