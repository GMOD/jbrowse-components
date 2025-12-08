import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'

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
} from '@mui/material'

import { useAsyncMenuItems } from './menuHooks'
import {
  ErrorMenuItem,
  LoadingMenuItem,
  MenuItemEndDecoration,
} from './MenuItems'
import { findLastIndex } from '../util'

import type { MenuItem, MenuItemsGetter } from './MenuTypes'
import type { MenuItemProps, MenuProps as MUIMenuProps, PopoverProps } from '@mui/material'

export type {
  MenuItem,
  MenuItemsGetter,
  MenuDivider,
  MenuSubHeader,
  BaseMenuItem,
  NormalMenuItem,
  CheckboxMenuItem,
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

type AnchorElProp = MUIMenuProps['anchorEl']
type OpenProp = MUIMenuProps['open']
type OnCloseProp = MUIMenuProps['onClose']

interface MenuPageProps {
  menuItems: MenuItem[]
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement>,
    callback: (...args: any[]) => void,
  ) => void
  anchorEl?: AnchorElProp
  open: OpenProp
  onClose: OnCloseProp
  top?: boolean
}

type MenuItemStyleProp = MenuItemProps['style']

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

const MenuPage = forwardRef<HTMLDivElement, MenuPageProps>(
  function MenuPage2(props, ref) {
    const [subMenuAnchorEl, setSubMenuAnchorEl] = useState<HTMLElement>()
    const [openSubMenuIdx, setOpenSubMenuIdx] = useState<number>()
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false)
    const [selectedMenuItemIdx, setSelectedMenuItemIdx] = useState<number>()
    const [position, setPosition] = useState<{
      top?: number
      left?: number
    }>()
    const paperRef = useRef<HTMLDivElement | null>(null)
    const { classes } = useStyles()

    const {
      menuItems,
      onMenuItemClick,
      open,
      onClose,
      anchorEl,
      top = false,
    } = props

    useEffect(() => {
      if (!open) {
        setSubMenuAnchorEl(undefined)
        setOpenSubMenuIdx(undefined)
      }
    }, [open])

    useEffect(() => {
      const shouldSubMenuBeOpen = open && Boolean(subMenuAnchorEl)
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
    }, [isSubMenuOpen, open, subMenuAnchorEl])

    useLayoutEffect(() => {
      if (anchorEl) {
        const rect = (anchorEl as HTMLElement).getBoundingClientRect()
        if (position) {
          if (
            rect.top !== position.top ||
            rect.left + rect.width !== position.left
          ) {
            setPosition({ top: rect.top, left: rect.left + rect.width })
          }
        } else {
          setPosition({ top: rect.top, left: rect.left + rect.width })
        }
      } else if (!position) {
        setPosition({})
      }
    }, [position, anchorEl])

    const hasIcon = menuItems.some(
      menuItem => 'icon' in menuItem && menuItem.icon,
    )
    const menuItemStyle: MenuItemStyleProp = {}

    function handleClick(callback: (...args: any[]) => void) {
      return (event: React.MouseEvent<HTMLLIElement>) => {
        onMenuItemClick(event, callback)
      }
    }

    const ListContents = (
      <>
        <MenuList autoFocusItem={open && !isSubMenuOpen} dense>
          {menuItems
            .toSorted((a, b) => (b.priority || 0) - (a.priority || 0))
            .map((menuItem, idx) => {
              if (menuItem.type === 'divider') {
                return (
                  <Divider
                    key={`divider-${JSON.stringify(menuItem)}-${idx}`}
                    component="li"
                  />
                )
              }
              if (menuItem.type === 'subHeader') {
                return (
                  <ListSubheader key={`subHeader-${menuItem.label}-${idx}`}>
                    {menuItem.label}
                  </ListSubheader>
                )
              }
              let icon = null
              let endDecoration = null
              if (menuItem.icon) {
                const Icon = menuItem.icon
                icon = (
                  <ListItemIcon>
                    <Icon />
                  </ListItemIcon>
                )
              }
              if ('subMenu' in menuItem) {
                endDecoration = <MenuItemEndDecoration type="subMenu" />
              } else if (
                menuItem.type === 'checkbox' ||
                menuItem.type === 'radio'
              ) {
                endDecoration = (
                  <MenuItemEndDecoration
                    type={menuItem.type}
                    checked={menuItem.checked}
                    disabled={menuItem.disabled}
                  />
                )
              }
              const onClick =
                'onClick' in menuItem
                  ? handleClick(menuItem.onClick)
                  : undefined
              return (
                <MUIMenuItem
                  key={menuItem.id || String(menuItem.label)}
                  style={menuItemStyle}
                  selected={idx === selectedMenuItemIdx}
                  onClick={onClick}
                  onMouseMove={e => {
                    if (e.currentTarget !== document.activeElement) {
                      e.currentTarget.focus()
                      setSelectedMenuItemIdx(idx)
                    }
                    if ('subMenu' in menuItem) {
                      if (openSubMenuIdx !== idx) {
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
                        const a = findNextValidIdx(menuItems, idx)
                        setSelectedMenuItemIdx(a)
                        break
                      }
                      default: {
                        if (
                          'subMenu' in menuItem &&
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
                  {icon}
                  <ListItemText
                    primary={menuItem.label}
                    secondary={menuItem.subLabel}
                    inset={hasIcon && !menuItem.icon}
                  />
                  {endDecoration}
                </MUIMenuItem>
              )
            })}
        </MenuList>
        {menuItems.map((menuItem, idx) => {
          let subMenu = null
          if ('subMenu' in menuItem) {
            subMenu = (
              <MenuPage
                key={menuItem.id || String(menuItem.label)}
                anchorEl={subMenuAnchorEl}
                open={isSubMenuOpen && openSubMenuIdx === idx}
                onClose={() => {
                  setIsSubMenuOpen(false)
                  setSubMenuAnchorEl(undefined)
                }}
                onMenuItemClick={onMenuItemClick}
                menuItems={menuItem.subMenu}
              />
            )
          }
          return subMenu
        })}
      </>
    )

    return top ? (
      ListContents
    ) : (
      <Grow
        in={open}
        style={{ transformOrigin: '0 0 0' }}
        timeout={100}
        ref={ref}
      >
        <Paper
          elevation={8}
          ref={paperRef}
          className={classes.paper}
          style={{ ...position }}
        >
          {ListContents}
        </Paper>
      </Grow>
    )
  },
)

export interface MenuProps extends PopoverProps {
  menuItems: MenuItemsGetter
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement>,
    callback: (...args: any[]) => void,
  ) => void
}

function Menu(props: MenuProps) {
  const { open, onClose, menuItems, onMenuItemClick, ...other } = props
  const { items, loading, error } = useAsyncMenuItems(menuItems, open)

  return (
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
  )
}

export default Menu
