import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Divider,
  Grow,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuItem as MUIMenuItem,
  MenuList,
  Paper,
  Popover,
  Typography,
} from '@mui/material'

import {
  ErrorMenuItem,
  LoadingMenuItem,
  MenuItemEndDecoration,
} from './MenuItems'
import { useAsyncMenuItems } from './menuHooks'
import { findLastIndex } from '../util'

import type { MenuItem, MenuItemsGetter } from './MenuTypes'
import type { MenuProps as MUIMenuProps, PopoverProps } from '@mui/material'

// Context for menu settings
const MenuSettingsContext = createContext({ showShortcuts: true })

export type {
  BaseMenuItem,
  CheckboxMenuItem,
  MenuDivider,
  MenuItem,
  MenuItemsGetter,
  MenuSubHeader,
  NormalMenuItem,
  RadioMenuItem,
  SubMenuItem,
} from './MenuTypes'
export { MenuItemEndDecoration } from './MenuItems'

const useStyles = makeStyles()({
  paper: {
    position: 'fixed',
    overflowY: 'auto',
    overflowX: 'hidden',
    minWidth: 16,
    minHeight: 16,
    maxWidth: 'calc(100% - 32px)',
    maxHeight: 'calc(100% - 32px)',
    top: 0,
    left: 0,
    outline: 0,
  },
})

function ShortcutDisplay({
  menuItem,
  hasSubMenu,
}: {
  menuItem: MenuItem
  hasSubMenu: boolean
}) {
  const { showShortcuts } = useContext(MenuSettingsContext)
  if (!showShortcuts) {
    return null
  }
  const shortcut = 'shortcut' in menuItem ? menuItem.shortcut : undefined
  if (!shortcut) {
    return hasSubMenu ? <div style={{ width: 24 }} /> : null
  }
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ ml: 2, mr: hasSubMenu ? 1 : 0 }}
    >
      {shortcut.toUpperCase()}
    </Typography>
  )
}

interface MenuPageProps {
  menuItems: MenuItem[]
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement>,
    callback: (...args: any[]) => void,
  ) => void
  anchorEl?: MUIMenuProps['anchorEl']
  open: MUIMenuProps['open']
  onClose: MUIMenuProps['onClose']
  top?: boolean
}

function checkIfValid(m: MenuItem) {
  return m.type !== 'divider' && m.type !== 'subHeader' && !m.disabled
}

function findNextValidIdx(menuItems: MenuItem[], currentIdx: number) {
  const idx = menuItems.slice(currentIdx + 1).findIndex(checkIfValid)
  if (idx === -1) {
    return idx
  }
  return currentIdx + 1 + idx
}

function findPreviousValidIdx(menuItems: MenuItem[], currentIdx: number) {
  return findLastIndex(menuItems.slice(0, currentIdx), checkIfValid)
}

function MenuPage({
  menuItems,
  onMenuItemClick,
  open,
  onClose,
  anchorEl,
  top = false,
}: MenuPageProps) {
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState<HTMLElement>()
  const [openSubMenuIdx, setOpenSubMenuIdx] = useState<number>()
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false)
  const [selectedMenuItemIdx, setSelectedMenuItemIdx] = useState<number>()
  const { classes } = useStyles()

  // Derive effective submenu state - when menu is closed, submenu is also closed
  const effectiveSubMenuAnchorEl = open ? subMenuAnchorEl : undefined
  const effectiveOpenSubMenuIdx = open ? openSubMenuIdx : undefined

  useEffect(() => {
    const shouldSubMenuBeOpen = open && Boolean(effectiveSubMenuAnchorEl)
    let timer: ReturnType<typeof setTimeout>
    if (shouldSubMenuBeOpen && !isSubMenuOpen) {
      timer = setTimeout(() => {
        setIsSubMenuOpen(true)
      }, 300)
    } else if (!shouldSubMenuBeOpen && isSubMenuOpen) {
      timer = setTimeout(() => {
        setIsSubMenuOpen(false)
      }, 300)
    }
    return () => {
      clearTimeout(timer)
    }
  }, [isSubMenuOpen, open, effectiveSubMenuAnchorEl])

  const position = useMemo(() => {
    if (anchorEl) {
      const rect = (anchorEl as HTMLElement).getBoundingClientRect()
      return { top: rect.top, left: rect.left + rect.width }
    }
    return {}
  }, [anchorEl])

  const hasIcon = menuItems.some(
    menuItem => 'icon' in menuItem && menuItem.icon,
  )

  const ListContents = (
    <>
      <MenuList autoFocusItem={open && !isSubMenuOpen} dense>
        {menuItems
          .toSorted((a, b) => (b.priority || 0) - (a.priority || 0))
          .map((menuItem, idx) => {
            if (menuItem.type === 'divider') {
              return <Divider key={`divider-${idx}`} component="li" />
            }
            if (menuItem.type === 'subHeader') {
              return (
                <ListSubheader key={`subHeader-${menuItem.label}-${idx}`}>
                  {menuItem.label}
                </ListSubheader>
              )
            }
            const isCheckOrRadio =
              menuItem.type === 'checkbox' || menuItem.type === 'radio'
            const hasSubMenu = 'subMenu' in menuItem

            return (
              <MUIMenuItem
                key={menuItem.id || String(menuItem.label)}
                selected={idx === selectedMenuItemIdx}
                onClick={
                  'onClick' in menuItem
                    ? e => {
                        onMenuItemClick(e, menuItem.onClick)
                      }
                    : undefined
                }
                onMouseMove={e => {
                  if (e.currentTarget !== document.activeElement) {
                    e.currentTarget.focus()
                    setSelectedMenuItemIdx(idx)
                  }
                  if (hasSubMenu) {
                    if (effectiveOpenSubMenuIdx !== idx) {
                      setSubMenuAnchorEl(e.currentTarget)
                      setOpenSubMenuIdx(idx)
                    }
                  } else {
                    setSubMenuAnchorEl(undefined)
                    setOpenSubMenuIdx(undefined)
                  }
                }}
                onKeyDown={e => {
                  switch (e.key) {
                    case 'ArrowLeft':
                    case 'Escape': {
                      onClose?.(e, 'escapeKeyDown')
                      break
                    }
                    case 'ArrowUp': {
                      setSelectedMenuItemIdx(
                        findPreviousValidIdx(menuItems, idx),
                      )
                      break
                    }
                    case 'ArrowDown': {
                      setSelectedMenuItemIdx(findNextValidIdx(menuItems, idx))
                      break
                    }
                    default: {
                      if (
                        hasSubMenu &&
                        (e.key === 'ArrowRight' || e.key === 'Enter')
                      ) {
                        setSubMenuAnchorEl(e.currentTarget)
                        setOpenSubMenuIdx(idx)
                        setIsSubMenuOpen(true)
                      }
                    }
                  }
                }}
                disabled={Boolean(menuItem.disabled)}
              >
                {menuItem.icon ? (
                  <ListItemIcon>
                    <menuItem.icon />
                  </ListItemIcon>
                ) : null}
                <ListItemText
                  primary={menuItem.label}
                  secondary={menuItem.subLabel}
                  inset={hasIcon && !menuItem.icon}
                />
                <ShortcutDisplay menuItem={menuItem} hasSubMenu={hasSubMenu} />
                {hasSubMenu ? (
                  <MenuItemEndDecoration type="subMenu" />
                ) : isCheckOrRadio ? (
                  <MenuItemEndDecoration
                    type={menuItem.type}
                    checked={menuItem.checked}
                    disabled={menuItem.disabled}
                  />
                ) : null}
              </MUIMenuItem>
            )
          })}
      </MenuList>
      {menuItems.map((menuItem, idx) =>
        'subMenu' in menuItem ? (
          <MenuPage
            key={menuItem.id || String(menuItem.label)}
            anchorEl={effectiveSubMenuAnchorEl}
            open={isSubMenuOpen && effectiveOpenSubMenuIdx === idx}
            onClose={() => {
              setIsSubMenuOpen(false)
              setSubMenuAnchorEl(undefined)
            }}
            onMenuItemClick={onMenuItemClick}
            menuItems={menuItem.subMenu}
          />
        ) : null,
      )}
    </>
  )

  return top ? (
    ListContents
  ) : (
    <Grow in={open} style={{ transformOrigin: '0 0 0' }} timeout={100}>
      <Paper elevation={8} className={classes.paper} style={position}>
        {ListContents}
      </Paper>
    </Grow>
  )
}

export interface MenuProps extends PopoverProps {
  menuItems: MenuItemsGetter
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement>,
    callback: (...args: any[]) => void,
  ) => void
  showShortcuts?: boolean
}

function Menu(props: MenuProps) {
  const {
    open,
    onClose,
    menuItems,
    onMenuItemClick,
    showShortcuts = true,
    ...other
  } = props
  const { items, loading, error } = useAsyncMenuItems(menuItems, open)

  return (
    <MenuSettingsContext.Provider value={{ showShortcuts }}>
      <Popover
        open={open}
        onClose={onClose}
        style={{ zIndex: 10000, ...other.style }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
          ...other.anchorOrigin,
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
          ...other.transformOrigin,
        }}
        {...other}
      >
        {loading ? (
          <MenuList dense>
            <LoadingMenuItem />
          </MenuList>
        ) : error ? (
          <MenuList dense>
            <ErrorMenuItem error={error} />
          </MenuList>
        ) : (
          <MenuPage
            open={open}
            onClose={onClose}
            menuItems={items}
            onMenuItemClick={onMenuItemClick}
            top
          />
        )}
      </Popover>
    </MenuSettingsContext.Provider>
  )
}

export default Menu
