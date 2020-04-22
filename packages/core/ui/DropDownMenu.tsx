import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useRef, useState } from 'react'
import Menu, { MenuOption } from './Menu'

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
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

function DropDownMenu({
  menuTitle,
  session,
  menuItems,
}: {
  menuTitle: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any
  menuItems: MenuOption[]
}) {
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)
  const classes = useStyles()

  function handleToggle() {
    setOpen(!open)
  }

  function handleMenuItemClick(
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (session: any) => void,
  ) {
    callback(session)
    handleClose()
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <div className={classes.root}>
      <Button
        ref={anchorEl}
        onClick={handleToggle}
        color="inherit"
        data-testid="dropDownMenuButton"
        classes={{ root: classes.buttonRoot }}
      >
        {menuTitle}
        <Icon>arrow_drop_down</Icon>
      </Button>
      <Menu
        anchorEl={anchorEl.current}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        onMenuItemClick={handleMenuItemClick}
        open={open}
        onClose={handleClose}
        menuOptions={menuItems}
      />
    </div>
  )
}

DropDownMenu.propTypes = {
  menuTitle: PropTypes.string.isRequired,
  menuItems: MobxPropTypes.arrayOrObservableArray.isRequired,
  session: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(DropDownMenu)
