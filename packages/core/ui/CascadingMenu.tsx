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
} from './MenuTypes'
import type { PopupState } from './hooks'
import type { SvgIconProps } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes'
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
      <MenuItem ref={setAnchorEl} onMouseOver={onOpen} onFocus={onOpen}>
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

export default function CascadingMenuChildren(props: {
  onMenuItemClick: Function
  closeAfterItemClick?: boolean
  menuItems: MenuItemsGetter
  popupState: PopupState
}) {
  const { closeAfterItemClick = true, menuItems, popupState } = props
  const { items, loading, error } = useAsyncMenuItems(
    menuItems,
    popupState.isOpen,
  )
  const { anchorEl, onClose, ...menuProps } = bindMenu(popupState)

  return (
    <Menu
      {...menuProps}
      anchorEl={anchorEl ?? null}
      onClose={() => {
        onClose()
      }}
    >
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
        />
      )}
    </Menu>
  )
}
