import AppLogo from '@jbrowse/core/ui/AppLogo'
import DropDownMenu from '@jbrowse/core/ui/DropDownMenu'
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Toolbar, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { AppSession } from './types.ts'

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
  logo: {
    // stretch to the toolbar height so the logo's height follows the bar
    // rather than a hardcoded pixel value
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    // autofit any logo (custom <img> or the default svg): full toolbar height
    // with auto width preserves aspect ratio, maxWidth caps horizontal room
    '& img, & svg': {
      height: '100%',
      width: 'auto',
      maxWidth: 150,
      objectFit: 'contain',
    },
  },
}))

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
          menuItems={menu.menuItems}
          // a root model's menu items take the session as their argument, and
          // the renderer decides how to invoke onClick — so this is the whole
          // binding. It used to be a recursive rewrite of every row of every
          // menu, rebuilt on each open, to arrive at the same call
          onMenuItemClick={callback => {
            callback(session)
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
      <div className={classes.logo}>
        <AppLogo session={session} />
      </div>
    </Toolbar>
  )
})

export default AppToolbar
