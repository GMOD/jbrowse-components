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

import HoverMenu from './HoverMenu.tsx'
import { MenuItemTrailing } from './MenuItemTrailing.tsx'

import type {
  BaseMenuItem,
  ClickableMenuItem,
  CustomMenuItem,
  MenuItem as JBMenuItem,
  MenuItemsGetter,
} from './MenuTypes.ts'
import type { PopoverOrigin } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes.ts'

interface CascadingMenuListProps {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  onMenuItemClick: (callback: () => void) => void
  onCloseRoot: () => void
  // close this menu level and refocus its opener (ArrowLeft); undefined at the
  // root level where there is nothing to go back to
  onNavigateBack?: () => void
}

// Build a `cascading-<kind>-<label>` data-testid, or undefined for non-string
// labels that can't be slugified
function makeTestId(kind: string, label: React.ReactNode) {
  return typeof label === 'string'
    ? `cascading-${kind}-${label.toLowerCase().replaceAll(/\s+/g, '_')}`
    : undefined
}

// Leading icon slot shared by submenu rows and clickable rows; renders nothing
// when the item has no icon (the row insets instead to stay column-aligned).
function MenuItemLeadingIcon({ Icon }: { Icon: React.ElementType | undefined }) {
  return Icon ? (
    <ListItemIcon>
      <Icon />
    </ListItemIcon>
  ) : null
}

// Which trailing/leading decoration columns the menu needs, computed menu-wide
// (true if ANY row needs it) so every row reserves matching slots and the
// decorations stack into aligned columns down the menu.
function getMenuColumnFlags(menuItems: JBMenuItem[]) {
  return {
    hasIcon: menuItems.some(m => 'icon' in m && m.icon),
    hasCheckboxOrRadioWithHelp: menuItems.some(
      m => (m.type === 'checkbox' || m.type === 'radio') && m.helpText,
    ),
    hasEndAdornment: menuItems.some(m => 'endAdornment' in m && m.endAdornment),
  }
}

// Renders arbitrary React content (e.g. a slider) as a plain list row, not a
// MenuItem: no click-to-close. Pointer/key events are kept local: the menu is
// portaled in the DOM but is still a React descendant of the view, so without
// this a slider drag bubbles (via React's synthetic-event tree) into the LGV's
// click-drag side-scroll, and arrow-key nudging gets stolen by the menu's own
// arrow navigation.
function CustomMenuRow({
  item,
  onCloseRoot,
}: {
  item: CustomMenuItem
  onCloseRoot: () => void
}) {
  return (
    <li
      style={{ padding: '4px 16px' }}
      onMouseDown={e => {
        e.stopPropagation()
      }}
      onKeyDown={e => {
        e.stopPropagation()
      }}
    >
      {item.render(onCloseRoot)}
    </li>
  )
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
  Icon: React.ElementType | undefined
  inset: boolean
  disabled?: boolean
  disabledHelpText?: string
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
} & CascadingMenuListProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)

  return (
    <>
      <DisabledTooltip item={{ disabled, disabledHelpText }}>
        <MenuItem
          ref={setAnchorEl}
          data-testid={makeTestId('submenu', title)}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={isOpen}
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
          <MenuItemLeadingIcon Icon={Icon} />
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

// One clickable menu row: label (with optional leading icon) plus its trailing
// value/help/adornment decorations. The menu-wide `has*` flags let every row
// reserve matching decoration slots so the columns line up down the menu.
function CascadingMenuItem({
  item,
  hasIcon,
  hasCheckboxOrRadioWithHelp,
  hasEndAdornment,
  closeAfterItemClick,
  onMenuItemClick,
  onCloseRoot,
  onNavigateBack,
  onMouseOver,
}: {
  item: ClickableMenuItem
  hasIcon: boolean
  hasCheckboxOrRadioWithHelp: boolean
  hasEndAdornment: boolean
  closeAfterItemClick: boolean
  onMenuItemClick: (callback: () => void) => void
  onCloseRoot: () => void
  onNavigateBack?: () => void
  onMouseOver: () => void
}) {
  return (
    // a disabled row can't open the help popover (pointer-events:none), so
    // disabledHelpText is surfaced as a hover tooltip instead of the icon button
    <DisabledTooltip item={item}>
      <MenuItem
        data-testid={makeTestId('menuitem', item.label)}
        disabled={item.disabled}
        onClick={() => {
          // onCloseRoot runs before the callback, so item.onClick must NOT read
          // model state that closing clears (e.g. a right-click menu's ephemeral
          // hit/context fields): capture that state when the menu items are
          // built, not live inside onClick.
          if (closeAfterItemClick) {
            onCloseRoot()
          }
          onMenuItemClick(item.onClick)
        }}
        onMouseOver={() => {
          onMouseOver()
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') {
            e.stopPropagation()
            onNavigateBack?.()
          }
        }}
      >
        <MenuItemLeadingIcon Icon={item.icon} />
        <ListItemText
          primary={item.label}
          secondary={item.subLabel}
          inset={hasIcon && !item.icon}
        />
        <MenuItemTrailing
          item={item}
          hasCheckboxOrRadioWithHelp={hasCheckboxOrRadioWithHelp}
          hasEndAdornment={hasEndAdornment}
        />
      </MenuItem>
    </DisabledTooltip>
  )
}

function CascadingMenuList({
  onMenuItemClick,
  closeAfterItemClick,
  menuItems,
  onCloseRoot,
  onNavigateBack,
}: CascadingMenuListProps) {
  const [openSubmenuIdx, setOpenSubmenuIdx] = useState<number | undefined>()
  const closeSubmenu = () => {
    setOpenSubmenuIdx(undefined)
  }

  const { hasIcon, hasCheckboxOrRadioWithHelp, hasEndAdornment } =
    getMenuColumnFlags(menuItems)

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
        if (item.type === 'custom') {
          return (
            <CustomMenuRow
              key={`custom-${item.label}`}
              item={item}
              onCloseRoot={onCloseRoot}
            />
          )
        }

        return (
          <CascadingMenuItem
            key={`menuitem-${item.label}`}
            item={item}
            hasIcon={hasIcon}
            hasCheckboxOrRadioWithHelp={hasCheckboxOrRadioWithHelp}
            hasEndAdornment={hasEndAdornment}
            closeAfterItemClick={closeAfterItemClick}
            onMenuItemClick={onMenuItemClick}
            onCloseRoot={onCloseRoot}
            onNavigateBack={onNavigateBack}
            onMouseOver={() => {
              closeSubmenu()
            }}
          />
        )
      })}
    </>
  )
}

interface CascadingMenuProps {
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
}: CascadingMenuProps) {
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
