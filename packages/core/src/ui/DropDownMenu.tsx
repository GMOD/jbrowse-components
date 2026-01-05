import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import { Button, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import CascadingMenuButton from './CascadingMenuButton'

import type { MenuItem } from './Menu'
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
}: {
  menuTitle: string
  menuItems: MenuItem[] | (() => MenuItem[])
}) {
  return (
    <CascadingMenuButton
      menuItems={menuItems}
      color="inherit"
      ButtonComponent={ButtonComponent}
    >
      {menuTitle}
      <ArrowDropDown />
    </CascadingMenuButton>
  )
})

export default DropDownMenu
