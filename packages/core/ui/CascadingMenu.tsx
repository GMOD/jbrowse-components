/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { createContext, useCallback, useContext, useRef, useState } from 'react'

import ChevronRight from '@mui/icons-material/ChevronRight'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'

import CascadingMenuHelpIconButton from './CascadingMenuHelpIconButton'
import HoverMenu from './HoverMenu'
import {
  ErrorMenuItem,
  LoadingMenuItem,
  MenuItemEndDecoration,
} from './MenuItems'
import { bindMenu } from './hooks'
import { useAsyncMenuItems } from './menuHooks'

import type {
  CheckboxMenuItem,
  MenuItem as JBMenuItem,
  MenuItemsGetter,
  NormalMenuItem,
  RadioMenuItem,
  SubMenuItem,
} from './MenuTypes'
import type { PopupState } from './hooks'
import type { SvgIconProps } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes'
type ActionableMenuItem = NormalMenuItem | CheckboxMenuItem | RadioMenuItem

// Context for menu settings - exported so callers can provide session settings
export const MenuSettingsContext = createContext({ showShortcuts: true })

function CascadingSubmenu({
  title,
  shortcut,
  Icon,
  inset,
  menuItems,
  onMenuItemClick,
  closeAfterItemClick,
  onCloseRoot,
  isOpen,
  onOpen,
  onClose,
}: {
  title: React.ReactNode
  shortcut?: string
  onMenuItemClick: Function
  Icon: React.ComponentType<SvgIconProps> | undefined
  inset: boolean
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onCloseRoot: () => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const { showShortcuts } = useContext(MenuSettingsContext)
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)
  const submenuListRef = useRef<HTMLDivElement>(null)
  const [openSubmenuIdx, setOpenSubmenuIdx] = useState<number | undefined>()

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onOpen()
        // Focus the first item in the submenu after it opens
        setTimeout(() => {
          const firstItem = submenuListRef.current?.querySelector(
            '[role="menuitem"]:not([aria-disabled="true"])',
          ) as HTMLElement | null
          firstItem?.focus()
        }, 0)
      }
    },
    [onOpen],
  )

  const handleSubmenuKeyDown = useMenuKeyboardHandler({
    menuItems,
    closeAfterItemClick,
    onCloseRoot,
    onMenuItemClick,
    onCloseSubmenu: onClose,
    parentAnchorEl: anchorEl,
    setOpenSubmenuIdx,
    containerRef: submenuListRef,
  })

  return (
    <>
      <MenuItem
        ref={setAnchorEl}
        onMouseOver={onOpen}
        onFocus={onOpen}
        onKeyDown={handleKeyDown}
      >
        {Icon ? (
          <ListItemIcon>
            <Icon />
          </ListItemIcon>
        ) : null}
        <ListItemText primary={title} inset={inset} />
        <div style={{ flexGrow: 1, minWidth: 10 }} />
        {shortcut && showShortcuts ? (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            {shortcut.toUpperCase()}
          </Typography>
        ) : null}
        <ChevronRight />
      </MenuItem>
      <HoverMenu
        open={isOpen}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onKeyDown={handleSubmenuKeyDown}
      >
        <div ref={submenuListRef}>
          <CascadingMenuList
            closeAfterItemClick={closeAfterItemClick}
            onMenuItemClick={onMenuItemClick}
            menuItems={menuItems}
            onCloseRoot={onCloseRoot}
            onCloseSubmenu={onClose}
            parentAnchorEl={anchorEl}
            openSubmenuIdx={openSubmenuIdx}
            setOpenSubmenuIdx={setOpenSubmenuIdx}
          />
        </div>
      </HoverMenu>
    </>
  )
}

function useMenuKeyboardHandler({
  menuItems,
  closeAfterItemClick,
  onCloseRoot,
  onMenuItemClick,
  onCloseSubmenu,
  parentAnchorEl,
  setOpenSubmenuIdx,
  containerRef,
}: {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onCloseRoot: () => void
  onMenuItemClick: Function
  onCloseSubmenu?: () => void
  parentAnchorEl?: HTMLElement | null
  setOpenSubmenuIdx: (idx: number | undefined) => void
  containerRef?: React.RefObject<HTMLDivElement | null>
}) {
  const sortedItems = menuItems.toSorted(
    (a, b) => (b.priority || 0) - (a.priority || 0),
  )

  // Track last activated shortcut for cycling through collisions
  const lastShortcutRef = useRef<{ key: string; index: number } | null>(null)

  return useCallback(
    (event: React.KeyboardEvent) => {
      // Handle ArrowLeft to go back to parent menu
      if (event.key === 'ArrowLeft' && onCloseSubmenu) {
        event.preventDefault()
        event.stopPropagation()
        onCloseSubmenu()
        parentAnchorEl?.focus()
        return
      }

      // Handle single character shortcuts
      const key = event.key.toLowerCase()
      if (key.length === 1 && /[a-z0-9]/.test(key)) {
        // Find all items with this shortcut
        const matchingItems: {
          item: ActionableMenuItem | SubMenuItem
          idx: number
        }[] = []
        for (const [i, sortedItem] of sortedItems.entries()) {
          const item = sortedItem
          if (item.type === 'divider' || item.type === 'subHeader') {
            continue
          }
          const menuItem = item as ActionableMenuItem | SubMenuItem
          if (menuItem.shortcut?.toLowerCase() === key && !menuItem.disabled) {
            matchingItems.push({ item: menuItem, idx: i })
          }
        }

        if (matchingItems.length === 0) {
          return
        }

        // Determine which item to activate (cycle through on repeated presses)
        let targetIdx = 0
        if (lastShortcutRef.current?.key === key && matchingItems.length > 1) {
          // Find the next item after the last activated one
          const lastIdx = lastShortcutRef.current.index
          const currentPos = matchingItems.findIndex(m => m.idx === lastIdx)
          targetIdx = (currentPos + 1) % matchingItems.length
        }

        const { item: menuItem, idx } = matchingItems[targetIdx]!
        lastShortcutRef.current = { key, index: idx }

        event.preventDefault()
        event.stopPropagation()

        if ('subMenu' in menuItem) {
          setOpenSubmenuIdx(idx)
          // Focus the first item in the submenu after it opens
          setTimeout(() => {
            const submenu = containerRef?.current?.querySelector(
              '[role="menu"]',
            ) as HTMLElement | null
            const firstItem = submenu?.querySelector(
              '[role="menuitem"]:not([aria-disabled="true"])',
            ) as HTMLElement | null
            firstItem?.focus()
          }, 0)
        } else if ('onClick' in menuItem) {
          if (closeAfterItemClick) {
            onCloseRoot()
          }
          onMenuItemClick(event, menuItem.onClick)
        }
      }
    },
    [
      sortedItems,
      onCloseSubmenu,
      parentAnchorEl,
      closeAfterItemClick,
      onCloseRoot,
      onMenuItemClick,
      setOpenSubmenuIdx,
      containerRef,
    ],
  )
}

function CascadingMenuList({
  onMenuItemClick,
  closeAfterItemClick,
  menuItems,
  onCloseRoot,
  onCloseSubmenu,
  parentAnchorEl,
  onKeyDown,
  openSubmenuIdx: openSubmenuIdxProp,
  setOpenSubmenuIdx: setOpenSubmenuIdxProp,
}: {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onMenuItemClick: Function
  onCloseRoot: () => void
  onCloseSubmenu?: () => void
  parentAnchorEl?: HTMLElement | null
  onKeyDown?: (event: React.KeyboardEvent) => void
  openSubmenuIdx?: number
  setOpenSubmenuIdx?: (idx: number | undefined) => void
}) {
  const { showShortcuts } = useContext(MenuSettingsContext)
  const [openSubmenuIdxLocal, setOpenSubmenuIdxLocal] = useState<
    number | undefined
  >()
  const openSubmenuIdx = openSubmenuIdxProp ?? openSubmenuIdxLocal
  const setOpenSubmenuIdx = setOpenSubmenuIdxProp ?? setOpenSubmenuIdxLocal
  const closeSubmenu = () => {
    setOpenSubmenuIdx(undefined)
  }

  const hasIcon = menuItems.some(m => 'icon' in m && m.icon)
  const hasCheckboxOrRadioWithHelp = menuItems.some(
    m =>
      (m.type === 'checkbox' || m.type === 'radio') &&
      'helpText' in m &&
      m.helpText,
  )
  const hasShortcut = menuItems.some(
    m => 'shortcut' in m && m.shortcut && m.type !== 'divider',
  )

  const sortedItems = menuItems.toSorted(
    (a, b) => (b.priority || 0) - (a.priority || 0),
  )

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onKeyDown={onKeyDown}>
      {sortedItems.map((item, idx) => {
        if ('subMenu' in item) {
          return (
            <CascadingSubmenu
              key={`subMenu-${item.label}-${idx}`}
              title={item.label}
              shortcut={item.shortcut}
              Icon={item.icon}
              inset={hasIcon && !item.icon}
              onMenuItemClick={onMenuItemClick}
              menuItems={item.subMenu}
              closeAfterItemClick={closeAfterItemClick}
              onCloseRoot={onCloseRoot}
              isOpen={openSubmenuIdx === idx}
              onOpen={() => {
                setOpenSubmenuIdx(idx)
              }}
              onClose={closeSubmenu}
            />
          )
        }
        if (item.type === 'divider') {
          return <Divider key={`divider-${idx}`} component="li" />
        }
        if (item.type === 'subHeader') {
          return (
            <ListSubheader key={`subHeader-${item.label}-${idx}`}>
              {item.label}
            </ListSubheader>
          )
        }

        const actionItem = item as ActionableMenuItem
        const helpText = actionItem.helpText
        const isCheckOrRadio =
          actionItem.type === 'checkbox' || actionItem.type === 'radio'

        return (
          <MenuItem
            key={`${actionItem.label}-${idx}`}
            disabled={Boolean(actionItem.disabled)}
            onClick={event => {
              onMenuItemClick(event, actionItem.onClick)
              if (closeAfterItemClick) {
                onCloseRoot()
              }
            }}
            onMouseOver={closeSubmenu}
          >
            {actionItem.icon ? (
              <ListItemIcon>
                <actionItem.icon />
              </ListItemIcon>
            ) : null}
            <ListItemText
              primary={actionItem.label}
              secondary={actionItem.subLabel}
              inset={hasIcon && !actionItem.icon}
            />
            <div style={{ flexGrow: 1, minWidth: 10 }} />
            {actionItem.shortcut && showShortcuts ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ ml: 2, mr: isCheckOrRadio || helpText ? 1 : 0 }}
              >
                {actionItem.shortcut.toUpperCase()}
              </Typography>
            ) : hasShortcut && showShortcuts && !isCheckOrRadio && !helpText ? (
              <div style={{ width: 24 }} />
            ) : null}
            {isCheckOrRadio ? (
              <MenuItemEndDecoration
                type={actionItem.type}
                checked={actionItem.checked}
                disabled={actionItem.disabled}
              />
            ) : null}
            {helpText ? (
              <CascadingMenuHelpIconButton
                helpText={helpText}
                label={actionItem.label}
              />
            ) : isCheckOrRadio && hasCheckboxOrRadioWithHelp ? (
              <div
                style={{ marginLeft: 4, padding: 4, width: 28, height: 28 }}
              />
            ) : null}
          </MenuItem>
        )
      })}
    </div>
  )
}

export default function CascadingMenuChildren(props: {
  onMenuItemClick: Function
  closeAfterItemClick?: boolean
  menuItems: MenuItemsGetter
  popupState: PopupState
  showShortcuts?: boolean
}) {
  const {
    closeAfterItemClick = true,
    menuItems,
    popupState,
    showShortcuts = true,
  } = props
  const { items, loading, error } = useAsyncMenuItems(
    menuItems,
    popupState.isOpen,
  )
  const { anchorEl, onClose, ...menuProps } = bindMenu(popupState)
  const [openSubmenuIdx, setOpenSubmenuIdx] = useState<number | undefined>()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useMenuKeyboardHandler({
    menuItems: items,
    closeAfterItemClick,
    onCloseRoot: onClose,
    onMenuItemClick: props.onMenuItemClick,
    setOpenSubmenuIdx,
    containerRef,
  })

  return (
    <MenuSettingsContext.Provider value={{ showShortcuts }}>
      <Menu
        {...menuProps}
        anchorEl={anchorEl ?? null}
        onClose={() => {
          onClose()
        }}
        onKeyDown={handleKeyDown}
      >
        <div ref={containerRef}>
          {loading ? (
            <LoadingMenuItem />
          ) : error ? (
            <ErrorMenuItem error={error} />
          ) : (
            <CascadingMenuList
              menuItems={items}
              closeAfterItemClick={closeAfterItemClick}
              onMenuItemClick={props.onMenuItemClick}
              onCloseRoot={onClose}
              openSubmenuIdx={openSubmenuIdx}
              setOpenSubmenuIdx={setOpenSubmenuIdx}
            />
          )}
        </div>
      </Menu>
    </MenuSettingsContext.Provider>
  )
}
