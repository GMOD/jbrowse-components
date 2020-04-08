import Button from '@material-ui/core/Button'
import ClickAwayListener from '@material-ui/core/ClickAwayListener'
import Divider from '@material-ui/core/Divider'
import Grow from '@material-ui/core/Grow'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import MenuItem from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'
import Paper from '@material-ui/core/Paper'
import Popper from '@material-ui/core/Popper'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useRef, useState } from 'react'

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
  },
  popper: {
    zIndex: theme.zIndex.drawer + 50,
  },
  grow: {
    transformOrigin: 'left top',
  },
  buttonRoot: {
    '&:hover': {
      backgroundColor: fade(
        theme.palette.primary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
}))

function DropDownMenu({ menuTitle, menuItems, session }) {
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)
  const classes = useStyles()

  function handleToggle() {
    setOpen(!open)
  }

  function handleClose(event, callback) {
    if (anchorEl.current.contains(event.target)) return

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
        classes={{ root: classes.buttonRoot }}
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
                  {values(menuItems).map((menuItem, idx) =>
                    menuItem.name === 'divider' ? (
                      <Divider key={`divider-${idx}`} />
                    ) : (
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
                    ),
                  )}
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
  menuTitle: PropTypes.string.isRequired,
  menuItems: MobxPropTypes.observableArray.isRequired,
  session: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(DropDownMenu)
