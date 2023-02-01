import React, { useRef, useState } from 'react'
import { Button, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'

import Menu, { MenuItem } from './Menu'

const useStyles = makeStyles()(theme => ({
  buttonRoot: {
    '&:hover': {
      backgroundColor: alpha(
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
  menuItems: MenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)
  const { classes } = useStyles()

  function handleToggle() {
    setOpen(!open)
  }

  function handleMenuItemClick(_event: unknown, callback: Function) {
    callback(session)
    handleClose()
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={anchorEl}
        onClick={handleToggle}
        color="inherit"
        data-testid="dropDownMenuButton"
        classes={{ root: classes.buttonRoot }}
      >
        {menuTitle}
        <ArrowDropDown />
      </Button>
      <Menu
        anchorEl={anchorEl.current}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        onMenuItemClick={handleMenuItemClick}
        open={open}
        onClose={handleClose}
        menuItems={menuItems}
      />
    </>
  )
}

export default observer(DropDownMenu)
