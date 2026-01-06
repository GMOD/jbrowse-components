/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { useState } from 'react'

import ChevronRight from '@mui/icons-material/ChevronRight'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from '@mui/material'

import CascadingMenuHelpIconButton from './CascadingMenuHelpIconButton.tsx'
import HoverMenu from './HoverMenu.tsx'
import { MenuItemEndDecoration } from './MenuItems.tsx'

import type {
  CheckboxMenuItem,
  MenuItem as JBMenuItem,
  MenuItemsGetter,
  NormalMenuItem,
  RadioMenuItem,
} from './MenuTypes.ts'
import type { SvgIconProps } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes.ts'
type ActionableMenuItem = NormalMenuItem | CheckboxMenuItem | RadioMenuItem

function CascadingSubmenu({
  title,
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
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)

  return (
    <>
      <MenuItem
        ref={setAnchorEl}
        onMouseOver={onOpen}
        onFocus={onOpen}
        onClick={onOpen}
      >
        {Icon ? (
          <ListItemIcon>
            <Icon />
          </ListItemIcon>
        ) : null}
        <ListItemText primary={title} inset={inset} />
        <ChevronRight />
      </MenuItem>
      <HoverMenu
        open={isOpen}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <CascadingMenuList
          closeAfterItemClick={closeAfterItemClick}
          onMenuItemClick={onMenuItemClick}
          menuItems={menuItems}
          onCloseRoot={onCloseRoot}
        />
      </HoverMenu>
    </>
  )
}

function CascadingMenuList({
  onMenuItemClick,
  closeAfterItemClick,
  menuItems,
  onCloseRoot,
}: {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onMenuItemClick: Function
  onCloseRoot: () => void
}) {
  const [openSubmenuIdx, setOpenSubmenuIdx] = useState<number | undefined>()
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

  const sortedItems = menuItems.toSorted(
    (a, b) => (b.priority || 0) - (a.priority || 0),
  )

  return (
    <>
      {sortedItems.map((item, idx) => {
        if ('subMenu' in item) {
          return (
            <CascadingSubmenu
              key={`subMenu-${item.label}-${idx}`}
              title={item.label}
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
              if (closeAfterItemClick) {
                onCloseRoot()
              }
              onMenuItemClick(event, actionItem.onClick)
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
    </>
  )
}

export default function CascadingMenu({
  onMenuItemClick,
  closeAfterItemClick = true,
  menuItems,
  open,
  onClose,
  anchorEl,
  anchorOrigin,
  transformOrigin,
  anchorReference,
  anchorPosition,
  slotProps,
  marginThreshold,
  style,
}: {
  onMenuItemClick: (event: unknown, callback: () => void) => void
  closeAfterItemClick?: boolean
  menuItems: MenuItemsGetter
  open: boolean
  onClose: () => void
  anchorEl?: Element | null
  anchorOrigin?: {
    vertical: 'top' | 'center' | 'bottom'
    horizontal: 'left' | 'center' | 'right'
  }
  transformOrigin?: {
    vertical: 'top' | 'center' | 'bottom'
    horizontal: 'left' | 'center' | 'right'
  }
  anchorReference?: 'anchorEl' | 'anchorPosition' | 'none'
  anchorPosition?: { top: number; left: number }
  slotProps?: { transition?: { onExit?: () => void } }
  marginThreshold?: number | null
  style?: React.CSSProperties
}) {
  const items = Array.isArray(menuItems) ? menuItems : menuItems()

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      anchorReference={anchorReference}
      anchorPosition={anchorPosition}
      slotProps={slotProps}
      marginThreshold={marginThreshold ?? undefined}
      style={style}
    >
      <CascadingMenuList
        menuItems={items}
        closeAfterItemClick={closeAfterItemClick}
        onMenuItemClick={onMenuItemClick}
        onCloseRoot={onClose}
      />
    </Menu>
  )
}
