import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import { Button, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import CascadingMenuButton from './CascadingMenuButton.tsx'

import type { MenuItem } from './Menu.tsx'
import type { MenuItemClickHandler } from './MenuTypes.ts'
import type { ButtonProps } from '@mui/material'

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

function ButtonComponent(props: ButtonProps) {
  const { classes } = useStyles()
  return (
    <Button {...props} className={classes.buttonRoot}>
      {props.children}
    </Button>
  )
}

const DropDownMenu = observer(function DropDownMenu({
  menuTitle,
  menuItems,
  onMenuItemClick,
}: {
  menuTitle: string
  menuItems: MenuItem[] | (() => MenuItem[])
  onMenuItemClick?: (callback: MenuItemClickHandler) => void
}) {
  return (
    <CascadingMenuButton
      menuItems={menuItems}
      onMenuItemClick={onMenuItemClick}
      color="inherit"
      ButtonComponent={ButtonComponent}
    >
      {menuTitle}
      <ArrowDropDown />
    </CascadingMenuButton>
  )
})

export default DropDownMenu
