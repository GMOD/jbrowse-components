import { useState } from 'react'

import ChevronRight from '@mui/icons-material/ChevronRight'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material'
import { observer } from 'mobx-react'

import CascadingMenuHelpIconButton, {
  CascadingMenuHelpIconSpacer,
} from './CascadingMenuHelpIconButton.tsx'
import HoverMenu from './HoverMenu.tsx'
import { MenuItemEndDecoration } from './MenuItems.tsx'

import type {
  BaseMenuItem,
  MenuItem as JBMenuItem,
  MenuItemsGetter,
} from './MenuTypes.ts'
import type { PopoverOrigin } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes.ts'

// Build a `cascading-<kind>-<label>` data-testid, or undefined for non-string
// labels that can't be slugified
function makeTestId(kind: string, label: React.ReactNode) {
  return typeof label === 'string'
    ? `cascading-${kind}-${label.toLowerCase().replaceAll(/\s+/g, '_')}`
    : undefined
}

// A disabled MenuItem has pointer-events:none, so a Tooltip placed directly on
// it never fires; the span wrapper (per MUI guidance) restores hover. Disabled
// rows aren't keyboard-focusable, so the extra wrapper doesn't affect menu
// navigation. Renders children untouched unless the item is disabled and has
// disabledHelpText.
function DisabledTooltip({
  item,
  children,
}: {
  item: Pick<BaseMenuItem, 'disabled' | 'disabledHelpText'>
  children: React.ReactElement
}) {
  return item.disabled && item.disabledHelpText ? (
    <Tooltip title={item.disabledHelpText} placement="left">
      <span>{children}</span>
    </Tooltip>
  ) : (
    children
  )
}

function CascadingSubmenu({
  title,
  Icon,
  inset,
  disabled,
  disabledHelpText,
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
  onMenuItemClick: (callback: () => void) => void
  Icon: React.ElementType | undefined
  inset: boolean
  disabled?: boolean
  disabledHelpText?: string
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onCloseRoot: () => void
  onNavigateBack?: () => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)

  return (
    <>
      <DisabledTooltip item={{ disabled, disabledHelpText }}>
        <MenuItem
          ref={setAnchorEl}
          data-testid={makeTestId('submenu', title)}
          disabled={disabled}
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
      </DisabledTooltip>
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
  onMenuItemClick: (callback: () => void) => void
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
    m => (m.type === 'checkbox' || m.type === 'radio') && m.helpText,
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
              key={`subMenu-${item.label}`}
              title={item.label}
              Icon={item.icon}
              inset={hasIcon && !item.icon}
              disabled={item.disabled}
              disabledHelpText={item.disabledHelpText}
              onMenuItemClick={onMenuItemClick}
              menuItems={item.subMenu}
              closeAfterItemClick={closeAfterItemClick}
              onCloseRoot={onCloseRoot}
              onNavigateBack={onNavigateBack}
              isOpen={openSubmenuIdx === idx && !item.disabled}
              onOpen={() => {
                if (!item.disabled) {
                  setOpenSubmenuIdx(idx)
                }
              }}
              onClose={() => {
                closeSubmenu()
              }}
            />
          )
        }
        if (item.type === 'divider') {
          // eslint-disable-next-line @eslint-react/no-array-index-key -- dividers have no identifying field, list order is fixed
          return <Divider key={`divider-${idx}`} component="li" />
        }
        if (item.type === 'subHeader') {
          return (
            <ListSubheader key={`subHeader-${item.label}`}>
              {item.label}
            </ListSubheader>
          )
        }

        const isCheckOrRadio = item.type === 'checkbox' || item.type === 'radio'
        // a disabled row can't open the help popover (pointer-events:none), so
        // disabledHelpText is surfaced as a hover tooltip instead of the icon button
        return (
          <DisabledTooltip key={`${item.label}`} item={item}>
            <MenuItem
              data-testid={makeTestId('menuitem', item.label)}
              disabled={item.disabled}
              onClick={() => {
                if (closeAfterItemClick) {
                  onCloseRoot()
                }
                onMenuItemClick(item.onClick)
              }}
              onMouseOver={() => {
                closeSubmenu()
              }}
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
              {item.helpText && !item.disabled ? (
                <CascadingMenuHelpIconButton
                  helpText={item.helpText}
                  label={item.label}
                />
              ) : isCheckOrRadio && hasCheckboxOrRadioWithHelp ? (
                <CascadingMenuHelpIconSpacer />
              ) : null}
            </MenuItem>
          </DisabledTooltip>
        )
      })}
    </>
  )
}

const CascadingMenu = observer(function CascadingMenu({
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
  style,
}: {
  onMenuItemClick: (callback: () => void) => void
  closeAfterItemClick?: boolean
  menuItems: MenuItemsGetter
  open: boolean
  onClose: () => void
  anchorEl?: Element | null
  anchorOrigin?: PopoverOrigin
  transformOrigin?: PopoverOrigin
  anchorReference?: 'anchorEl' | 'anchorPosition' | 'none'
  anchorPosition?: { top: number; left: number }
  slotProps?: { transition?: { onExit?: () => void } }
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
})

export default CascadingMenu
