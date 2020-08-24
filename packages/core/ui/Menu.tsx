import Divider from '@material-ui/core/Divider'
import Grow from '@material-ui/core/Grow'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import { MenuProps as MUIMenuProps } from '@material-ui/core/Menu'
import MenuItem, { MenuItemProps } from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'
import Paper from '@material-ui/core/Paper'
import Popover, { PopoverProps } from '@material-ui/core/Popover'
import { SvgIconProps } from '@material-ui/core/SvgIcon'
import { makeStyles } from '@material-ui/core/styles'
import ArrowRightIcon from '@material-ui/icons/ArrowRight'
import CheckBoxIcon from '@material-ui/icons/CheckBox'
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank'
import RadioButtonCheckedIcon from '@material-ui/icons/RadioButtonChecked'
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked'
import React, { useEffect, useRef, useState } from 'react'
import { findLastIndex } from '../util'

const useStyles = makeStyles({
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
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    padding: 12,
    marginRight: -12,
    display: 'inline-flex',
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

function MenuItemEndDecoration(props: MenuItemEndDecorationProps) {
  const classes = useStyles()
  const { type } = props
  let checked
  let disabled
  if ('checked' in props) {
    ;({ checked, disabled } = props)
  }
  let icon
  if (type === 'subMenu') {
    icon = <ArrowRightIcon color="action" />
  } else if (type === 'checkbox') {
    if (checked) {
      const color = disabled ? 'inherit' : 'secondary'
      icon = <CheckBoxIcon color={color} />
    } else {
      icon = <CheckBoxOutlineBlankIcon color="action" />
    }
  } else if (type === 'radio') {
    if (checked) {
      const color = disabled ? 'inherit' : 'secondary'
      icon = <RadioButtonCheckedIcon color={color} />
    } else {
      icon = <RadioButtonUncheckedIcon color="action" />
    }
  }
  return <div className={classes.menuItemEndDecoration}>{icon}</div>
}

interface MenuDivider {
  type: 'divider'
}

interface MenuSubHeader {
  type: 'subHeader'
  label: string
}

interface BaseMenuItem {
  label: string
  subLabel?: string
  icon?: React.ComponentType<SvgIconProps>
  disabled?: boolean
}

interface NormalMenuItem extends BaseMenuItem {
  type?: 'normal'
  onClick: Function
}

interface CheckboxMenuItem extends BaseMenuItem {
  type: 'checkbox'
  checked: boolean
  onClick: Function
}

interface RadioMenuItem extends BaseMenuItem {
  type: 'radio'
  checked: boolean
  onClick: Function
}

interface SubMenuItem extends BaseMenuItem {
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

const MenuPage = React.forwardRef((props: MenuPageProps, ref) => {
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState<null | HTMLElement>(
    null,
  )
  const [openSubMenuIdx, setOpenSubMenuIdx] = useState<null | number>(null)
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false)
  const [selectedMenuItemIdx, setSelectedMenuItemIdx] = useState<null | number>(
    null,
  )
  const [position, setPosition] = useState<null | {
    top?: number
    left?: number
  }>(null)
  const paperRef = useRef<null | HTMLDivElement>(null)
  const classes = useStyles()

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
      setSubMenuAnchorEl(null)
      setOpenSubMenuIdx(null)
    }
  }, [open])

  useEffect(() => {
    const shouldSubMenuBeOpen = open && Boolean(subMenuAnchorEl)
    let timer: NodeJS.Timeout
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

  const hasEndDecoration = menuItems.some(
    menuItem =>
      'subMenu' in menuItem ||
      menuItem.type === 'checkbox' ||
      menuItem.type === 'radio',
  )
  const hasIcon = menuItems.some(
    menuItem => 'icon' in menuItem && menuItem.icon,
  )
  const menuItemStyle: MenuItemStyleProp = {}
  if (hasEndDecoration) {
    menuItemStyle.paddingRight = 48
  }

  function handleClick(callback: Function) {
    return (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
      onMenuItemClick(event, callback)
    }
  }

  const ListContents = (
    <>
      <MenuList autoFocusItem={open && !isSubMenuOpen}>
        {menuItems.map((menuItem, idx) => {
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
            'onClick' in menuItem ? handleClick(menuItem.onClick) : undefined
          return (
            <MenuItem
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
                  setSubMenuAnchorEl(null)
                  setOpenSubMenuIdx(null)
                }
              }}
              onKeyDown={e => {
                if (e.key === 'ArrowLeft' || e.key === 'Escape') {
                  onClose && onClose(e, 'escapeKeyDown')
                } else if (e.key === 'ArrowUp') {
                  setSelectedMenuItemIdx(findPreviousValidIdx(menuItems, idx))
                } else if (e.key === 'ArrowDown') {
                  const a = findNextValidIdx(menuItems, idx)
                  setSelectedMenuItemIdx(a)
                } else if ('subMenu' in menuItem) {
                  if (e.key === 'ArrowRight' || e.key === 'Enter') {
                    setSubMenuAnchorEl(e.currentTarget)
                    setOpenSubMenuIdx(idx)
                    setIsSubMenuOpen(true)
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
            </MenuItem>
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
                setSubMenuAnchorEl(null)
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

  if (top) {
    return ListContents
  }

  return (
    <Grow in={open} style={{ transformOrigin: '0 0 0' }} ref={ref}>
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
})

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
