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

import type { MenuItem as JBMenuItem, MenuItemsGetter } from './MenuTypes.ts'

export type { MenuItemsGetter } from './MenuTypes.ts'

// Build a `cascading-<kind>-<label>` data-testid, or undefined for non-string
// labels that can't be slugified
function makeTestId(kind: string, label: React.ReactNode) {
  if (typeof label === 'string') {
    return `cascading-${kind}-${label.toLowerCase().replace(/\s+/g, '_')}`
  }
  return undefined
}

function CascadingSubmenu({
  title,
  Icon,
  inset,
  menuItems,
  onMenuItemClick,
  closeAfterItemClick,
  onCloseRoot,
  onNavigateBack,
  isOpen,
  onOpen,
  onClose,
}: {
  title: React.ReactNode
  onMenuItemClick: (event: unknown, callback: () => void) => void
  Icon: React.ElementType | undefined
  inset: boolean
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onCloseRoot: () => void
  onNavigateBack: (() => void) | undefined
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)

  return (
    <>
      <MenuItem
        ref={setAnchorEl}
        data-testid={makeTestId('submenu', title)}
        onMouseOver={() => {
          onOpen()
        }}
        onClick={() => {
          onOpen()
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') {
            onOpen()
          } else if (e.key === 'ArrowLeft') {
            e.stopPropagation()
            onNavigateBack?.()
          }
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
          onNavigateBack={() => {
            onClose()
            anchorEl?.focus()
          }}
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
  onNavigateBack,
}: {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onMenuItemClick: (event: unknown, callback: () => void) => void
  onCloseRoot: () => void
  // close this menu level and refocus its opener (ArrowLeft); undefined at the
  // root level where there is nothing to go back to
  onNavigateBack?: () => void
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
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
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
              onNavigateBack={onNavigateBack}
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

        const helpText = item.helpText
        const isCheckOrRadio = item.type === 'checkbox' || item.type === 'radio'
        return (
          <MenuItem
            key={`${item.label}-${idx}`}
            data-testid={makeTestId('menuitem', item.label)}
            disabled={Boolean(item.disabled)}
            onClick={event => {
              if (closeAfterItemClick) {
                onCloseRoot()
              }
              onMenuItemClick(event, item.onClick)
            }}
            onMouseOver={closeSubmenu}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft') {
                e.stopPropagation()
                onNavigateBack?.()
              }
            }}
          >
            {item.icon ? (
              <ListItemIcon>
                <item.icon />
              </ListItemIcon>
            ) : null}
            <ListItemText
              primary={item.label}
              secondary={item.subLabel}
              inset={hasIcon && !item.icon}
            />
            <div style={{ flexGrow: 1, minWidth: 10 }} />
            {isCheckOrRadio ? (
              <MenuItemEndDecoration
                type={item.type}
                checked={item.checked}
                disabled={item.disabled}
              />
            ) : null}
            {helpText ? (
              <CascadingMenuHelpIconButton
                helpText={helpText}
                label={item.label}
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
