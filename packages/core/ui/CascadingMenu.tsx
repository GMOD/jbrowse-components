/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type React from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import ChevronRight from '@mui/icons-material/ChevronRight'
import {
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from '@mui/material'

import CascadingMenuHelpIconButton from './CascadingMenuHelpIconButton'
import HoverMenu from './HoverMenu'
import { MenuItemEndDecoration } from './Menu'
import { bindFocus, bindHover, bindMenu, usePopupState } from './hooks'

import type { MenuItem as JBMenuItem } from './Menu'
import type { PopupState } from './hooks'
import type { PopoverOrigin, SvgIconProps } from '@mui/material'

export type MenuItemsGetter =
  | JBMenuItem[]
  | (() => JBMenuItem[])
  | (() => Promise<JBMenuItem[]>)

function useAsyncMenuItems(
  menuItems: MenuItemsGetter,
  isOpen: boolean,
): { items: JBMenuItem[]; loading: boolean; error: unknown } {
  const [state, setState] = useState<{
    items: JBMenuItem[]
    loading: boolean
    error: unknown
  }>({
    items: [],
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!isOpen) {
      setState({ items: [], loading: false, error: null })
      return
    }

    if (Array.isArray(menuItems)) {
      setState({ items: menuItems, loading: false, error: null })
      return
    }

    let cancelled = false
    setState(s => ({ ...s, loading: true, error: null }))

    Promise.resolve(menuItems())
      .then(items => {
        if (!cancelled) {
          setState({ items, loading: false, error: null })
        }
      })
      .catch(error => {
        if (!cancelled) {
          setState({ items: [], loading: false, error })
        }
      })

    return () => {
      cancelled = true
    }
  }, [menuItems, isOpen])

  return state
}

const CascadingContext = createContext({
  parentPopupState: undefined,
  rootPopupState: undefined,
} as {
  parentPopupState: PopupState | undefined
  rootPopupState: PopupState | undefined
})

function HelpIconSpacer() {
  // Empty spacer that matches HelpIconButton dimensions for alignment
  return <div style={{ marginLeft: 4, padding: 4, width: 28, height: 28 }} />
}

function CascadingMenuItem({
  onClick,
  closeAfterItemClick,
  children,
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
        // Close any existing child submenu when hovering over a regular menu item
        // Note: This logic is duplicated in CascadingSubmenu for consistency
        if (parentPopupState?.childHandle) {
          parentPopupState.childHandle.close()
          parentPopupState.setChildHandle(undefined)
        }
      }}
    >
      {children}
    </MenuItem>
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

  const { onMouseOver: originalOnMouseOver, ...hoverProps } =
    bindHover(popupState)

  return (
    <>
      <MenuItem
        {...bindFocus(popupState)}
        {...hoverProps}
        onMouseOver={event => {
          // Close any existing sibling submenus before opening this one
          // Note: This logic is duplicated from CascadingMenuItem for consistency
          if (parentPopupState?.childHandle) {
            parentPopupState.childHandle.close()
            parentPopupState.setChildHandle(undefined)
          }
          // Call the original hover handler to open this submenu
          originalOnMouseOver(event)
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
  children,
  ...props
}: {
  popupState: PopupState
  onMenuItemClick: Function
  menuItems: JBMenuItem[]
  children?: React.ReactNode
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
      <Menu {...props} {...bindMenu(popupState)}>
        {children}
      </Menu>
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
  const hasCheckboxOrRadioWithHelp = menuItems.some(
    m =>
      (m.type === 'checkbox' || m.type === 'radio') &&
      'helpText' in m &&
      m.helpText,
  )

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
              {item.type === 'checkbox' || item.type === 'radio' ? (
                'helpText' in item && item.helpText ? (
                  <CascadingMenuHelpIconButton
                    helpText={item.helpText}
                    label={item.label}
                  />
                ) : hasCheckboxOrRadioWithHelp ? (
                  <HelpIconSpacer />
                ) : null
              ) : 'helpText' in item && item.helpText ? (
                <CascadingMenuHelpIconButton
                  helpText={item.helpText}
                  label={item.label}
                />
              ) : null}
            </CascadingMenuItem>
          )
        })}
    </>
  )
}

function CascadingSpacer() {
  return <div style={{ flexGrow: 1, minWidth: 10 }} />
}

function LoadingMenuItem() {
  return (
    <MenuItem disabled>
      <ListItemIcon>
        <CircularProgress size={20} />
      </ListItemIcon>
      <ListItemText primary="Loading..." />
    </MenuItem>
  )
}

function ErrorMenuItem({ error }: { error: unknown }) {
  return (
    <MenuItem disabled>
      <ListItemText
        primary="Error loading menu"
        secondary={error instanceof Error ? error.message : String(error)}
      />
    </MenuItem>
  )
}

function CascadingMenuChildren(props: {
  onMenuItemClick: Function
  closeAfterItemClick?: boolean
  menuItems: MenuItemsGetter
  popupState: PopupState
}) {
  const { closeAfterItemClick = true, menuItems, popupState, ...rest } = props
  const { items, loading, error } = useAsyncMenuItems(
    menuItems,
    popupState.isOpen,
  )

  return (
    <CascadingMenu {...rest} popupState={popupState} menuItems={items}>
      {loading ? (
        <LoadingMenuItem />
      ) : error ? (
        <ErrorMenuItem error={error} />
      ) : (
        <CascadingMenuList
          {...rest}
          menuItems={items}
          closeAfterItemClick={closeAfterItemClick}
        />
      )}
    </CascadingMenu>
  )
}

export default CascadingMenuChildren
