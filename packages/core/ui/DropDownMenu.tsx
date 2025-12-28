import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import { Button, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import CascadingMenu from './CascadingMenu'
import { bindTrigger, usePopupState } from './hooks'

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
  const { classes } = useStyles()
  const popupState = usePopupState()
  const { isOpen } = popupState
  const showShortcuts =
    'showMenuShortcuts' in session ? session.showMenuShortcuts : true

  return (
    <>
      <Button
        {...bindTrigger(popupState)}
        color="inherit"
        data-testid="dropDownMenuButton"
        classes={{ root: classes.buttonRoot }}
      >
        {menuTitle}
        <ArrowDropDown />
      </Button>
      {isOpen ? (
        <CascadingMenu
          onMenuItemClick={(_: unknown, callback: (arg: unknown) => void) => {
            callback(session)
          }}
          menuItems={menuItems}
          popupState={popupState}
          showShortcuts={showShortcuts}
        />
      ) : null}
    </>
  )
})

export default DropDownMenu
