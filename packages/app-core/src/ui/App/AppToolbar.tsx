import React from 'react'
import { Toolbar, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// locals
import {
  NotificationLevel,
  SessionWithDrawerWidgets,
  SnackAction,
} from '@jbrowse/core/util'

// ui elements
import DropDownMenu from '@jbrowse/core/ui/DropDownMenu'
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import AppLogo from '@jbrowse/core/ui/AppLogo'
import { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'

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

type SnackbarMessage = [string, NotificationLevel, SnackAction]

type AppSession = SessionWithDrawerWidgets & {
  savedSessionNames: string[]
  menus: { label: string; menuItems: JBMenuItem[] }[]
  renameCurrentSession: (arg: string) => void
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => unknown
}

const AppToolbar = observer(function ({
  session,
  HeaderButtons = <div />,
}: {
  HeaderButtons?: React.ReactElement
  session: AppSession
}) {
  const { classes } = useStyles()
  const { savedSessionNames, name, menus } = session

  return (
    <Toolbar>
      {menus.map(menu => (
        <DropDownMenu
          key={menu.label}
          menuTitle={menu.label}
          menuItems={menu.menuItems}
          session={session}
        />
      ))}
      <div className={classes.grow} />
      <Tooltip title="Rename Session" arrow>
        <EditableTypography
          value={name}
          setValue={newName => {
            if (savedSessionNames?.includes(newName)) {
              session.notify(
                `Cannot rename session to "${newName}", a saved session with that name already exists`,
                'warning',
              )
            } else {
              session.renameCurrentSession(newName)
            }
          }}
          variant="body1"
          classes={{
            inputBase: classes.inputBase,
            inputRoot: classes.inputRoot,
            inputFocused: classes.inputFocused,
          }}
        />
      </Tooltip>
      {HeaderButtons}
      <div className={classes.grow} />
      <div style={{ width: 150, maxHeight: 48 }}>
        <AppLogo session={session} />
      </div>
    </Toolbar>
  )
})

export default AppToolbar
