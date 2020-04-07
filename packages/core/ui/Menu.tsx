import Divider from '@material-ui/core/Divider'
import Grow from '@material-ui/core/Grow'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import { MenuProps as MUIMenuProps } from '@material-ui/core/Menu'
import MenuItem, { MenuItemProps } from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'
import Paper from '@material-ui/core/Paper'
import Popover, { PopoverProps } from '@material-ui/core/Popover'
import { makeStyles } from '@material-ui/core/styles'
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
    icon = <Icon color="action">arrow_right</Icon>
  } else if (type === 'checkbox') {
    if (checked) {
      const color = disabled ? 'inherit' : 'secondary'
      icon = <Icon color={color}>check_box</Icon>
    } else {
      icon = <Icon color="action">check_box_outline_blank</Icon>
    }
  } else if (type === 'radio') {
    if (checked) {
      const color = disabled ? 'inherit' : 'secondary'
      icon = <Icon color={color}>radio_button_checked</Icon>
    } else {
      icon = <Icon color="action">radio_button_unchecked</Icon>
    }
  }
  return <div className={classes.menuItemEndDecoration}>{icon}</div>
}

interface MenuDivider {
  type: 'divider'
}

interface BaseMenuItem {
  label: string
  subLabel?: string
  icon?: string
  disabled?: boolean
}

interface NormalMenuItem extends BaseMenuItem {
  type?: 'normal'
  onClick: () => void
}

interface CheckboxMenuItem extends BaseMenuItem {
  type: 'checkbox'
  checked: boolean
  onClick: () => void
}

interface RadioMenuItem extends BaseMenuItem {
  type: 'radio'
  checked: boolean
  onClick: () => void
}

interface SubMenuItem extends BaseMenuItem {
  type?: 'subMenu'
  subMenu: MenuOptions[]
}

export type MenuOptions =
  | MenuDivider
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem
  | SubMenuItem

type AnchorElProp = MUIMenuProps['anchorEl']
type AnchorReferenceProp = MUIMenuProps['anchorReference']
type AnchorPositionProp = MUIMenuProps['anchorPosition']
type OpenProp = MUIMenuProps['open']
type OnCloseProp = MUIMenuProps['onClose']

interface MenuPageProps {
  menuOptions: MenuOptions[]
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    callback: () => void,
  ) => void
  anchorEl?: AnchorElProp
  open: OpenProp
  onClose: OnCloseProp
  top?: boolean
}

type MenuItemStyleProp = MenuItemProps['style']

function findNextValidIdx(menuOptions: MenuOptions[], currentIdx: number) {
  const idx = menuOptions
    .slice(currentIdx + 1)
    .findIndex(
      menuOption => menuOption.type !== 'divider' && !menuOption.disabled,
    )
  if (idx === -1) {
    return idx
  }
  return currentIdx + 1 + idx
}

function findPreviousValidIdx(menuOptions: MenuOptions[], currentIdx: number) {
  return findLastIndex(
    menuOptions.slice(0, currentIdx),
    menuOption => menuOption.type !== 'divider' && !menuOption.disabled,
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
    menuOptions,
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

  const hasEndDecoration = menuOptions.some(
    menuOption =>
      'subMenu' in menuOption ||
      menuOption.type === 'checkbox' ||
      menuOption.type === 'radio',
  )
  const hasIcon = menuOptions.some(
    menuOption => 'icon' in menuOption && menuOption.icon,
  )
  const menuItemStyle: MenuItemStyleProp = {}
  if (hasEndDecoration) {
    menuItemStyle.paddingRight = 48
  }

  function handleClick(callback: () => void) {
    return (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
      onMenuItemClick(event, callback)
    }
  }

  const ListContents = (
    <>
      <MenuList autoFocusItem={open && !isSubMenuOpen}>
        {menuOptions.map((menuOption, idx) => {
          if (menuOption.type === 'divider') {
            return <Divider key={`divider-${idx}`} component="li" />
          }
          let icon = null
          let endDecoration = null
          if (menuOption.icon) {
            icon = (
              <ListItemIcon>
                <Icon>{menuOption.icon}</Icon>
              </ListItemIcon>
            )
          }
          if ('subMenu' in menuOption) {
            endDecoration = <MenuItemEndDecoration type="subMenu" />
          } else if (
            menuOption.type === 'checkbox' ||
            menuOption.type === 'radio'
          ) {
            endDecoration = (
              <MenuItemEndDecoration
                type={menuOption.type}
                checked={menuOption.checked}
                disabled={menuOption.disabled}
              />
            )
          }
          let onClick
          if ('onClick' in menuOption) {
            onClick = handleClick(menuOption.onClick)
          }
          return (
            <MenuItem
              key={menuOption.label}
              style={menuItemStyle}
              selected={idx === selectedMenuItemIdx}
              onClick={onClick}
              onMouseMove={e => {
                if (e.currentTarget !== document.activeElement) {
                  e.currentTarget.focus()
                  setSelectedMenuItemIdx(idx)
                }
                if ('subMenu' in menuOption) {
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
                  setSelectedMenuItemIdx(findPreviousValidIdx(menuOptions, idx))
                } else if (e.key === 'ArrowDown') {
                  const a = findNextValidIdx(menuOptions, idx)
                  setSelectedMenuItemIdx(a)
                } else if ('subMenu' in menuOption) {
                  if (e.key === 'ArrowRight' || e.key === 'Enter') {
                    setSubMenuAnchorEl(e.currentTarget)
                    setOpenSubMenuIdx(idx)
                    setIsSubMenuOpen(true)
                  }
                }
              }}
              disabled={Boolean(menuOption.disabled)}
            >
              {icon}
              <ListItemText
                primary={menuOption.label}
                secondary={menuOption.subLabel}
                inset={hasIcon && !menuOption.icon}
              />
              {endDecoration}
            </MenuItem>
          )
        })}
      </MenuList>
      {menuOptions.map((menuOption, idx) => {
        let subMenu = null
        if ('subMenu' in menuOption) {
          subMenu = (
            <MenuPage
              key={menuOption.label}
              anchorEl={subMenuAnchorEl}
              open={isSubMenuOpen && openSubMenuIdx === idx}
              onClose={() => {
                setIsSubMenuOpen(false)
                setSubMenuAnchorEl(null)
              }}
              onMenuItemClick={onMenuItemClick}
              menuOptions={menuOption.subMenu}
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
  menuOptions: MenuOptions[]
  onMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    callback: () => void,
  ) => void
}

function Menu(props: MenuProps) {
  const { open, onClose, menuOptions, onMenuItemClick, ...other } = props
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
        menuOptions={menuOptions}
        onMenuItemClick={onMenuItemClick}
        top
      />
    </Popover>
  )
}

export default Menu
