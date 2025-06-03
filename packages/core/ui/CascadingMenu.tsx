/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type React from 'react'
import { createContext, useContext, useMemo } from 'react'

import ChevronRight from '@mui/icons-material/ChevronRight'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from '@mui/material'

import HoverMenu from './HoverMenu'
import { MenuItemEndDecoration } from './Menu'
import { bindFocus, bindHover, bindMenu, usePopupState } from './hooks'

import type { MenuItem as JBMenuItem } from './Menu'
import type { PopupState } from './hooks'
import type { PopoverOrigin, SvgIconProps } from '@mui/material'

const CascadingContext = createContext({
  parentPopupState: undefined,
  rootPopupState: undefined,
} as {
  parentPopupState: PopupState | undefined
  rootPopupState: PopupState | undefined
})

function CascadingMenuItem({
  onClick,
  closeAfterItemClick,
  ...props
}: {
  closeAfterItemClick: boolean
  onClick?: (event: React.MouseEvent<HTMLLIElement>) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const { rootPopupState, parentPopupState } = useContext(CascadingContext)
  if (!rootPopupState) {
    throw new Error('must be used inside a CascadingMenu')
  }

  return (
    <MenuItem
      {...props}
      onClick={event => {
        if (closeAfterItemClick) {
          rootPopupState.close()
        }
        onClick?.(event)
      }}
      onMouseOver={() => {
        if (parentPopupState?.childHandle) {
          parentPopupState.childHandle.close()
          parentPopupState.setChildHandle(undefined)
        }
      }}
    />
  )
}

function CascadingSubmenu({
  title,
  Icon,
  inset,
  ...props
}: {
  children: React.ReactNode
  title: React.ReactNode
  onMenuItemClick: Function
  Icon: React.ComponentType<SvgIconProps> | undefined
  inset: boolean
  menuItems: JBMenuItem[]
}) {
  const { parentPopupState } = useContext(CascadingContext)
  const popupState = usePopupState({
    parentPopupState,
  })

  return (
    <>
      <MenuItem
        {...bindFocus(popupState)}
        onMouseOver={(event: React.MouseEvent) => {
          if (parentPopupState?.childHandle) {
            parentPopupState.childHandle.close()
            parentPopupState.setChildHandle(undefined)
          }

          // Use the existing bindHover functionality
          bindHover(popupState).onMouseOver(event)
        }}
      >
        {Icon ? (
          <ListItemIcon>
            <Icon />
          </ListItemIcon>
        ) : null}
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
      {/* @ts-expect-error */}
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
      {/* @ts-expect-error */}
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
  closeAfterItemClick,
  menuItems,
  ...props
}: {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onMenuItemClick: Function
}) {
  const hasIcon = menuItems.some(m => 'icon' in m && m.icon)
  return (
    <>
      {menuItems
        .toSorted((a, b) => (b.priority || 0) - (a.priority || 0))
        .map((item, idx) => {
          return 'subMenu' in item ? (
            <CascadingSubmenu
              key={`subMenu-${item.label}-${idx}`}
              title={item.label}
              Icon={item.icon}
              inset={hasIcon && !item.icon}
              onMenuItemClick={onMenuItemClick}
              menuItems={item.subMenu}
            >
              <CascadingMenuList
                {...props}
                closeAfterItemClick={closeAfterItemClick}
                onMenuItemClick={onMenuItemClick}
                menuItems={item.subMenu}
              />
            </CascadingSubmenu>
          ) : item.type === 'divider' ? (
            <Divider
              key={`divider-${JSON.stringify(item)}-${idx}`}
              component="li"
            />
          ) : item.type === 'subHeader' ? (
            <ListSubheader key={`subHeader-${item.label}-${idx}`}>
              {item.label}
            </ListSubheader>
          ) : (
            <CascadingMenuItem
              key={`${item.label}-${idx}`}
              closeAfterItemClick={closeAfterItemClick}
              onClick={
                'onClick' in item
                  ? event => {
                      onMenuItemClick(event, item.onClick)
                    }
                  : undefined
              }
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
              <CascadingSpacer />
              <EndDecoration item={item} />
            </CascadingMenuItem>
          )
        })}
    </>
  )
}

function CascadingSpacer() {
  return <div style={{ flexGrow: 1, minWidth: 10 }} />
}

function CascadingMenuChildren(props: {
  onMenuItemClick: Function
  closeAfterItemClick?: boolean
  menuItems: JBMenuItem[]
  popupState: PopupState
}) {
  const { closeAfterItemClick = true, ...rest } = props
  return (
    <CascadingMenu {...rest}>
      <CascadingMenuList {...rest} closeAfterItemClick={closeAfterItemClick} />
    </CascadingMenu>
  )
}

export default CascadingMenuChildren
