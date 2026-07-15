import AppLogo from '@jbrowse/core/ui/AppLogo'
import DropDownMenu from '@jbrowse/core/ui/DropDownMenu'
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Toolbar, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { AppSession } from './types.ts'
import type { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'

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

// bind the session into each item's onClick (the renderer invokes onClick with
// no args), recursing into sub-menus; dividers/sub-headers pass through
function wrapMenuItems(items: JBMenuItem[], session: AppSession): JBMenuItem[] {
  return items.map(item =>
    'subMenu' in item
      ? { ...item, subMenu: wrapMenuItems(item.subMenu, session) }
      : 'onClick' in item
        ? {
            ...item,
            onClick: () => {
              item.onClick(session)
            },
          }
        : item,
  )
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
      <div className={classes.logo}>
        <AppLogo session={session} />
      </div>
    </Toolbar>
  )
})

export default AppToolbar
