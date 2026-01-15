import AppLogo from '@jbrowse/core/ui/AppLogo'
import DropDownMenu from '@jbrowse/core/ui/DropDownMenu'
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Toolbar, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'
import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  grow: {
    flexGrow: 1,
  },
  inputBase: {
    color: theme.palette.primary.contrastText,
  },
  inputRoot: {
    '&:hover': {
      backgroundColor: theme.palette.primary.light,
    },
  },
  inputFocused: {
    borderColor: theme.palette.secondary.main,
    backgroundColor: theme.palette.primary.light,
  },
}))

interface Menu {
  label: string
  menuItems: JBMenuItem[] | (() => JBMenuItem[])
}

type AppSession = SessionWithDrawerWidgets & {
  menus: () => Menu[]
  snackbarMessages: SnackbarMessage[]
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
}

function wrapMenuItems(items: JBMenuItem[], session: AppSession): JBMenuItem[] {
  return items.map(item => ({
    ...item,
    ...('onClick' in item
      ? {
          onClick: () => {
            item.onClick(session)
          },
        }
      : {}),
    ...('subMenu' in item
      ? { subMenu: wrapMenuItems(item.subMenu, session) }
      : {}),
  }))
}

const AppToolbar = observer(function AppToolbar({
  session,
  HeaderButtons = <div />,
}: {
  HeaderButtons?: React.ReactElement
  session: AppSession
}) {
  const { classes } = useStyles()
  const { name, menus } = session

  return (
    <Toolbar>
      {menus().map(menu => (
        <DropDownMenu
          key={menu.label}
          menuTitle={menu.label}
          menuItems={() => {
            const items =
              typeof menu.menuItems === 'function'
                ? menu.menuItems()
                : menu.menuItems
            return wrapMenuItems(items, session)
          }}
        />
      ))}
      <div className={classes.grow} />
      <Tooltip title="Rename session" arrow>
        <EditableTypography
          value={name}
          variant="body1"
          classes={{
            inputBase: classes.inputBase,
            inputRoot: classes.inputRoot,
            inputFocused: classes.inputFocused,
          }}
          setValue={newName => {
            session.renameCurrentSession(newName)
          }}
        />
      </Tooltip>
      {HeaderButtons}
      <div className={classes.grow} />
      <div
        style={{
          width: 150,
          maxHeight: 48,
        }}
      >
        <AppLogo session={session} />
      </div>
    </Toolbar>
  )
})

export default AppToolbar
