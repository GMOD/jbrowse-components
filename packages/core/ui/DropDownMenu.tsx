import { useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import { Button, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import Menu from './Menu'

import type { MenuItem } from './Menu'
import type { AbstractSessionModel } from '../util'

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

const DropDownMenu = observer(function DropDownMenu({
  menuTitle,
  session,
  menuItems,
}: {
  menuTitle: string
  session: AbstractSessionModel
  menuItems: MenuItem[] | (() => MenuItem[])
}) {
  const [open, setOpen] = useState(false)
  const anchorEl = useRef(null)
  const { classes } = useStyles()

  function handleClose() {
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={anchorEl}
        color="inherit"
        data-testid="dropDownMenuButton"
        classes={{ root: classes.buttonRoot }}
        onClick={() => {
          setOpen(!open)
        }}
      >
        {menuTitle}
        <ArrowDropDown />
      </Button>
      {open ? (
        <Menu
          open
          anchorEl={anchorEl.current}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          onClose={handleClose}
          menuItems={typeof menuItems === 'function' ? menuItems() : menuItems}
          onMenuItemClick={(_event, callback) => {
            callback(session)
            handleClose()
          }}
        />
      ) : null}
    </>
  )
})

export default DropDownMenu
