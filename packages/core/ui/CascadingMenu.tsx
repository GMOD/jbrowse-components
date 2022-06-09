import React, { useContext, useMemo, useCallback } from 'react'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  PopoverOrigin,
} from '@mui/material'
import { MenuItem as JBMenuItem, MenuItemEndDecoration } from './Menu'
import {
  bindHover,
  bindFocus,
  bindMenu,
  usePopupState,
  PopupState,
} from 'material-ui-popup-state/hooks'
import HoverMenu from 'material-ui-popup-state/HoverMenu'
import ChevronRight from '@mui/icons-material/ChevronRight'

const CascadingContext = React.createContext({
  parentPopupState: null,
  rootPopupState: null,
} as { parentPopupState: PopupState | null; rootPopupState: PopupState | null })

function CascadingMenuItem({
  onClick,
  ...props
}: {
  onClick?: Function
  disabled?: boolean
  children: React.ReactNode
}) {
  const { rootPopupState } = useContext(CascadingContext)
  if (!rootPopupState) {
    throw new Error('must be used inside a CascadingMenu')
  }
  const handleClick = useCallback(
    (event: any) => {
      // @ts-ignore
      rootPopupState.close(event)
      if (onClick) {
        onClick(event)
      }
    },
    [rootPopupState, onClick],
  )

  return <MenuItem {...props} onClick={handleClick} />
}

function CascadingSubmenu({
  title,
  inset,
  popupId,
  ...props
}: {
  children: React.ReactNode
  title: string
  onMenuItemClick: Function
  menuItems: JBMenuItem[]
  inset: boolean
  popupId: string
}) {
  const { parentPopupState } = React.useContext(CascadingContext)
  const popupState = usePopupState({
    popupId,
    variant: 'popover',
    parentPopupState,
  })
  return (
    <>
      <MenuItem {...bindHover(popupState)} {...bindFocus(popupState)}>
        <ListItemText primary={title} inset={inset} />
        <ChevronRight />
      </MenuItem>
      <CascadingSubmenuHover
        {...props}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        popupState={popupState}
      />
    </>
  )
}

function CascadingSubmenuHover({
  popupState,
  onMenuItemClick,
  menuItems,
  classes,
  ...props
}: {
  classes?: Record<string, string>
  popupState: PopupState
  anchorOrigin: PopoverOrigin
  transformOrigin: PopoverOrigin
  onMenuItemClick: Function
  menuItems: JBMenuItem[]
}) {
  const { rootPopupState } = useContext(CascadingContext)
  const context = useMemo(
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

function CascadingMenu({
  popupState,
  onMenuItemClick,
  menuItems,
  ...props
}: {
  popupState: PopupState
  onMenuItemClick: Function
  menuItems: JBMenuItem[]
}) {
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
      <Menu {...props} {...bindMenu(popupState)} />
    </CascadingContext.Provider>
  )
}

function EndDecoration({ item }: { item: JBMenuItem }) {
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

function CascadingMenuList({
  onMenuItemClick,
  menuItems,
  ...props
}: {
  menuItems: JBMenuItem[]
  onMenuItemClick: Function
}) {
  function handleClick(callback: Function) {
    return (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
      onMenuItemClick(event, callback)
    }
  }

  const hasIcon = menuItems.some(
    menuItem => 'icon' in menuItem && menuItem.icon,
  )
  return (
    <>
      {menuItems.map((item, idx) => {
        return 'subMenu' in item ? (
          <CascadingSubmenu
            key={`subMenu-${item.label}-${idx}`}
            popupId={`subMenu-${item.label}`}
            title={item.label}
            inset={hasIcon}
            onMenuItemClick={onMenuItemClick}
            menuItems={item.subMenu}
          >
            <CascadingMenuList
              {...props}
              onMenuItemClick={onMenuItemClick}
              menuItems={item.subMenu}
            />
          </CascadingSubmenu>
        ) : item.type === 'divider' ? (
          <Divider key={`divider-${idx}`} component="li" />
        ) : item.type === 'subHeader' ? (
          <ListSubheader key={`subHeader-${item.label}-${idx}`}>
            {item.label}
          </ListSubheader>
        ) : (
          <CascadingMenuItem
            key={`${item.label}-${idx}`}
            onClick={'onClick' in item ? handleClick(item.onClick) : undefined}
            disabled={Boolean(item.disabled)}
          >
            {item.icon ? (
              <ListItemIcon>
                <item.icon />
              </ListItemIcon>
            ) : null}{' '}
            <ListItemText
              primary={item.label}
              secondary={item.subLabel}
              inset={hasIcon && !item.icon}
            />
            <div style={{ flexGrow: 1, minWidth: 10 }} />
            <EndDecoration item={item} />
          </CascadingMenuItem>
        )
      })}
    </>
  )
}

function CascadingMenuChildren(props: {
  onMenuItemClick: Function
  menuItems: JBMenuItem[]
  popupState: PopupState
}) {
  return (
    <CascadingMenu {...props}>
      <CascadingMenuList {...props} />
    </CascadingMenu>
  )
}

export default CascadingMenuChildren
