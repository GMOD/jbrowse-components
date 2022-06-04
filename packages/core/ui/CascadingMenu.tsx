import React, { useContext, useCallback } from 'react'
import { ListItemIcon, MenuItem, makeStyles } from '@material-ui/core'
import { MenuItemEndDecoration } from './Menu'
import {
  bindHover,
  bindFocus,
  bindMenu,
  usePopupState,
} from 'material-ui-popup-state/hooks'
import HoverMenu from 'material-ui-popup-state/HoverMenu'
import ChevronRight from '@material-ui/icons/ChevronRight'

const useCascadingMenuStyles = makeStyles(theme => ({
  submenu: {
    // marginTop: theme.spacing(-1),
  },
  title: {
    flexGrow: 1,
  },
  moreArrow: {
    // marginRight: theme.spacing(-1),
  },
  menuItem: {
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
  },
}))

const CascadingContext = React.createContext({
  parentPopupState: null,
  rootPopupState: null,
})

function CascadingMenuItem({ onClick, ...props }: any) {
  const classes = useCascadingMenuStyles()
  const { rootPopupState } = useContext(CascadingContext)
  if (!rootPopupState) throw new Error('must be used inside a CascadingMenu')
  const handleClick = useCallback(
    event => {
      rootPopupState.close(event)
      if (onClick) onClick(event)
    },
    [rootPopupState, onClick],
  )

  return (
    <MenuItem className={classes.menuItem} {...props} onClick={handleClick} />
  )
}

function CascadingSubmenu({ title, popupId, ...props }: any) {
  const classes = useCascadingMenuStyles()
  const { parentPopupState } = React.useContext(CascadingContext)
  const popupState = usePopupState({
    popupId,
    variant: 'popover',
    parentPopupState,
  })
  return (
    <React.Fragment>
      <MenuItem {...bindHover(popupState)} {...bindFocus(popupState)}>
        <span className={classes.title}>{title}</span>
        <ChevronRight className={classes.moreArrow} />
      </MenuItem>
      <CascadingMenu
        {...props}
        classes={{ ...props.classes, paper: classes.submenu }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        popupState={popupState}
      />
    </React.Fragment>
  )
}

function CascadingMenu({ popupState, ...props }: any) {
  const { rootPopupState } = React.useContext(CascadingContext)
  const context = React.useMemo(
    () => ({
      rootPopupState: rootPopupState || popupState,
      parentPopupState: popupState,
    }),
    [rootPopupState, popupState],
  )

  return (
    <CascadingContext.Provider value={context}>
      <HoverMenu {...props} {...bindMenu(popupState)} />
    </CascadingContext.Provider>
  )
}

function EndDecoration({ item }: any) {
  if ('subMenu' in item) {
    return <MenuItemEndDecoration type="subMenu" />
  } else if (item.type === 'checkbox' || item.type === 'radio') {
    return (
      <MenuItemEndDecoration
        type={item.type}
        checked={item.checked}
        disabled={item.disabled}
      />
    )
  }
  return null
}

function CascadingMenuList(props: any) {
  const { onMenuItemClick, menuItems } = props
  function handleClick(callback: Function) {
    return (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
      onMenuItemClick(event, callback)
    }
  }
  console.log(props)
  return (
    <>
      {menuItems.map(item => {
        const { label } = item
        console.log(item)
        return item.subMenu ? (
          <CascadingSubmenu
            popupId="moreChoicesCascadingMenu"
            title={item.label}
          >
            <CascadingMenuList {...props} menuItems={item.subMenu} />
          </CascadingSubmenu>
        ) : (
          <CascadingMenuItem
            onClick={'onClick' in item ? handleClick(item.onClick) : undefined}
          >
            {item.icon ? (
              <ListItemIcon>
                <item.icon />
              </ListItemIcon>
            ) : null}{' '}
            {label}
            <div style={{ flexGrow: 1, minWidth: 10 }} />
            <EndDecoration item={item} />
          </CascadingMenuItem>
        )
      })}
    </>
  )
}

function CascadingMenuChildren(props: any) {
  return (
    <CascadingMenu {...props}>
      <CascadingMenuList {...props} />
    </CascadingMenu>
  )
}

export default CascadingMenuChildren
