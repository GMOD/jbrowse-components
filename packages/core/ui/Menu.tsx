import React, { useEffect, useRef, useState } from 'react'
import {
  Divider,
  Grow,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuProps as MUIMenuProps,
  MenuItem as MUIMenuItem,
  MenuItemProps,
  MenuList,
  Paper,
  Popover,
  PopoverProps,
  SvgIconProps,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
// icons
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'

// other
import { findLastIndex } from '../util'

const useStyles = makeStyles()({
  paper: {
    position: 'fixed',
    overflowY: 'auto',
    overflowX: 'hidden',
    // So we see the popover when it's empty.
    minWidth: 16,
    minHeight: 16,
    maxWidth: 'calc(100% - 32px)',
    maxHeight: 'calc(100% - 32px)',
    top: 0,
    left: 0,
    // We disable the focus ring for mouse, touch and keyboard users.
    outline: 0,
  },
  menuItemEndDecoration: {
    padding: 0,
    margin: 0,
    height: 16,
  },
})

interface MenuItemEndDecorationSubMenuProps {
  type: 'subMenu'
}

interface MenuItemEndDecorationSelectorProps {
  type: 'checkbox' | 'radio'
  checked: boolean
  disabled?: boolean
}

type MenuItemEndDecorationProps =
  | MenuItemEndDecorationSubMenuProps
  | MenuItemEndDecorationSelectorProps

export function MenuItemEndDecoration(props: MenuItemEndDecorationProps) {
  const { classes } = useStyles()
  const { type } = props
  let checked
  let disabled
  if ('checked' in props) {
    ;({ checked, disabled } = props)
  }
  let icon
  switch (type) {
    case 'subMenu': {
      icon = <ArrowRightIcon color="action" />
      break
    }
    case 'checkbox': {
      if (checked) {
        const color = disabled ? 'inherit' : undefined
        icon = <CheckBoxIcon color={color} />
      } else {
        icon = <CheckBoxOutlineBlankIcon color="action" />
      }
      break
    }
    case 'radio': {
      if (checked) {
        const color = disabled ? 'inherit' : undefined
        icon = <RadioButtonCheckedIcon color={color} />
      } else {
        icon = <RadioButtonUncheckedIcon color="action" />
      }
      break
    }
    // No default
  }
  return <div className={classes.menuItemEndDecoration}>{icon}</div>
}

export interface MenuDivider {
  priority?: number
  type: 'divider'
}

export interface MenuSubHeader {
  type: 'subHeader'
  priority?: number
  label: string
}

export interface BaseMenuItem {
  label: string
  priority?: number
  subLabel?: string
  icon?: React.ComponentType<SvgIconProps>
  disabled?: boolean
}

export interface NormalMenuItem extends BaseMenuItem {
  type?: 'normal'
  onClick: Function
}

export interface CheckboxMenuItem extends BaseMenuItem {
  type: 'checkbox'
  checked: boolean
  onClick: Function
}

export interface RadioMenuItem extends BaseMenuItem {
  type: 'radio'
  checked: boolean
  onClick: Function
}

export interface SubMenuItem extends BaseMenuItem {
  type?: 'subMenu'
  subMenu: MenuItem[]
}

export type MenuItem =
  | MenuDivider
  | MenuSubHeader
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem
  | SubMenuItem

type AnchorElProp = MUIMenuProps['anchorEl']
type OpenProp = MUIMenuProps['open']
type OnCloseProp = MUIMenuProps['onClose']

interface MenuPageProps {
  menuItems: MenuItem[]
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    callback: Function,
  ) => void
  anchorEl?: AnchorElProp
  open: OpenProp
  onClose: OnCloseProp
  top?: boolean
}

type MenuItemStyleProp = MenuItemProps['style']

function findNextValidIdx(menuItems: MenuItem[], currentIdx: number) {
  const idx = menuItems
    .slice(currentIdx + 1)
    .findIndex(
      menuItem =>
        menuItem.type !== 'divider' &&
        menuItem.type !== 'subHeader' &&
        !menuItem.disabled,
    )
  if (idx === -1) {
    return idx
  }
  return currentIdx + 1 + idx
}

function findPreviousValidIdx(menuItems: MenuItem[], currentIdx: number) {
  return findLastIndex(
    menuItems.slice(0, currentIdx),
    menuItem =>
      menuItem.type !== 'divider' &&
      menuItem.type !== 'subHeader' &&
      !menuItem.disabled,
  )
}

const MenuPage = React.forwardRef<HTMLDivElement, MenuPageProps>(
  (props, ref) => {
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

    useEffect(() => {
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

    function handleClick(callback: Function) {
      return (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
        onMenuItemClick(event, callback)
      }
    }

    const ListContents = (
      <>
        <MenuList autoFocusItem={open && !isSubMenuOpen} dense>
          {menuItems
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
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
                  key={menuItem.label}
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
                        onClose && onClose(e, 'escapeKeyDown')

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
                key={menuItem.label}
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
      <Grow in={open} style={{ transformOrigin: `0 0 0` }} ref={ref}>
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

interface MenuProps extends PopoverProps {
  menuItems: MenuItem[]
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    callback: Function,
  ) => void
}

function Menu(props: MenuProps) {
  const { open, onClose, menuItems, onMenuItemClick, ...other } = props

  return (
    <Popover
      open={open}
      onClose={onClose}
      BackdropProps={{ invisible: true }}
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
      <MenuPage
        open={open}
        onClose={onClose}
        menuItems={menuItems}
        onMenuItemClick={onMenuItemClick}
        top
      />
    </Popover>
  )
}

export default Menu
