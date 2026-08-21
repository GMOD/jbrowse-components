import { useState } from 'react'

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

import { makeStyles } from '../util/tss-react/index.ts'
import HoverMenu from './HoverMenu.tsx'
import { MenuItemTrailing } from './MenuItemTrailing.tsx'
import { staysOpenOnClick } from './MenuTypes.ts'
import { hasMenuItemAdornment } from './menuItemAdornment.tsx'

import type { MenuColumnFlags } from './MenuItemTrailing.tsx'
import type {
  BaseMenuItem,
  ClickableMenuItem,
  CustomMenuItem,
  MenuItem as JBMenuItem,
  MenuItemClickHandler,
  MenuItemsGetter,
  SubMenuItem,
} from './MenuTypes.ts'
import type { PopoverOrigin } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes.ts'

// Compact section headers so tall menus (e.g. a display's flat "Show..."
// settings list with several subHeader-separated radio groups) stay short.
// Row heights are left at the MUI default.
const useStyles = makeStyles()(theme => ({
  subHeader: {
    lineHeight: '1.8em',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    // doubles as the section divider: a rule above the header groups the rows
    // beneath it without spending a separate divider row
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: 4,
  },
}))

interface CascadingMenuListProps {
  menuItems: JBMenuItem[]
  closeAfterItemClick: boolean
  // how a row's onClick is invoked, at every depth — the menu itself never
  // calls it. A caller whose items expect a context argument supplies it here
  // (`cb => { cb(session) }`) rather than rewriting the items to close over it
  onMenuItemClick: (callback: MenuItemClickHandler) => void
  onCloseRoot: () => void
  // close this menu level and refocus its opener (ArrowLeft); undefined at the
  // root level where there is nothing to go back to
  onNavigateBack?: () => void
  // The root menu's stacking level, carried down to every submenu portal. Each
  // level is its own MUI Menu, so a submenu left on MUI's default modal z-index
  // sits UNDER a root that was raised off that scale (ContextMenu clears the
  // tooltip layer) — and the root's modal spans the viewport, so its backdrop
  // takes every click and hover the submenu rows never see. Undefined leaves
  // MUI's default, which is what a menu opened from a button wants.
  zIndex?: React.CSSProperties['zIndex']
}

// Identity of a submenu row, used both as its React key and to remember which
// submenu is open. Deliberately not the array index: the items are re-derived on
// every observable change (a checkbox toggle can add or drop a row above), so an
// index-keyed "open" flag would follow the position rather than the submenu and
// the open panel would jump to whichever row landed at that index.
function submenuKey(label: React.ReactNode) {
  return `subMenu-${label}`
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
function MenuItemLeadingIcon({
  Icon,
}: {
  Icon: React.ElementType | undefined
}) {
  return Icon ? (
    <ListItemIcon>
      <Icon />
    </ListItemIcon>
  ) : null
}

// Which decoration columns the menu needs, computed menu-wide (true if ANY row
// needs it) so every row reserves matching slots and the decorations stack into
// aligned columns down the menu. Per list, so a submenu's own rows answer it for
// themselves. `hasIcon` is the leading column; `columns` is the trailing stack
// `MenuItemTrailing` draws for both row kinds, and every predicate below counts
// submenu rows and clickable rows alike because both draw that stack.
function getMenuColumnFlags(menuItems: JBMenuItem[]) {
  // a disabled row surfaces its help as a hover tooltip instead of the "?"
  // button (see DisabledTooltip), so it must not claim the column either — or a
  // menu whose only help row is disabled reserves a spacer on every row for a
  // button that never renders
  const hasCheckboxOrRadioWithHelp = menuItems.some(
    m =>
      (m.type === 'checkbox' || m.type === 'radio') &&
      m.helpText &&
      !m.disabled,
  )
  const hasEndAdornment = menuItems.some(m => hasMenuItemAdornment(m))
  // a single row carrying both a help "?" and a trailing adornment (e.g. pin) is
  // the only case that genuinely needs help and adornment in separate columns
  const hasRowWithHelpAndAdornment = menuItems.some(
    m =>
      hasMenuItemAdornment(m) &&
      'helpText' in m &&
      m.helpText &&
      !('disabled' in m && m.disabled),
  )
  return {
    hasIcon: menuItems.some(m => 'icon' in m && m.icon),
    columns: {
      hasCheckboxOrRadioWithHelp,
      hasEndAdornment,
      // Gated on a submenu row that actually draws help, not on there being a
      // submenu at all: the reservation exists to pull the clickable rows' "?"
      // into the column a chevron pushes a submenu row's "?" out of. In a menu
      // where no submenu row has help there is nothing to line up with, and
      // reserving it there would only unalign a checkbox glyph from the chevron
      // it currently sits level with.
      hasSubmenuWithHelp: menuItems.some(
        m => 'subMenu' in m && m.helpText && !m.disabled,
      ),
      // when help and adornment never collide on one row, they collapse into
      // one shared trailing column instead of each claiming its own, so a menu
      // mixing help-only and pin-only rows doesn't reserve a wasted third
      // column
      sharedActionColumn:
        hasCheckboxOrRadioWithHelp &&
        hasEndAdornment &&
        !hasRowWithHelpAndAdornment,
    },
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

// One submenu row: label (with optional leading icon), the same trailing
// decorations a clickable row draws, and the panel it opens.
//
// A submenu row carries its own `helpText` — for the question the rows inside it
// are answers to, which an option table of individually-helped entries still
// leaves nowhere to state — and its own trailing adornment (a color swatch, a
// toggle), whose content stops its own click so using it doesn't also open the
// submenu. Both go through `MenuItemTrailing`, so they land in the columns the
// clickable rows reserve rather than in a hand-assembled copy of them.
function CascadingSubmenu({
  item,
  inset,
  columns,
  onMenuItemClick,
  closeAfterItemClick,
  onCloseRoot,
  onNavigateBack,
  zIndex,
  isOpen,
  onOpen,
  onClose,
}: {
  item: SubMenuItem
  inset: boolean
  columns: MenuColumnFlags
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
} & Omit<CascadingMenuListProps, 'menuItems'>) {
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)

  return (
    <>
      <DisabledTooltip item={item}>
        <MenuItem
          ref={setAnchorEl}
          data-testid={makeTestId('submenu', item.label)}
          disabled={item.disabled}
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
          <MenuItemLeadingIcon Icon={item.icon} />
          <ListItemText primary={item.label} inset={inset} />
          <MenuItemTrailing item={item} columns={columns} />
        </MenuItem>
      </DisabledTooltip>
      <HoverMenu
        open={isOpen}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        zIndex={zIndex}
      >
        <CascadingMenuList
          closeAfterItemClick={closeAfterItemClick}
          onMenuItemClick={onMenuItemClick}
          menuItems={item.subMenu}
          onCloseRoot={onCloseRoot}
          zIndex={zIndex}
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
// value/help/adornment decorations. The menu-wide `columns` flags let every row
// reserve matching decoration slots so the columns line up down the menu.
function CascadingMenuItem({
  item,
  hasIcon,
  columns,
  closeAfterItemClick,
  onMenuItemClick,
  onCloseRoot,
  onNavigateBack,
  onMouseOver,
}: {
  item: ClickableMenuItem
  hasIcon: boolean
  columns: MenuColumnFlags
  closeAfterItemClick: boolean
  onMenuItemClick: (callback: MenuItemClickHandler) => void
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
          if (closeAfterItemClick && !staysOpenOnClick(item)) {
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
        <MenuItemTrailing item={item} columns={columns} />
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
  zIndex,
}: CascadingMenuListProps) {
  const { classes } = useStyles()
  const [openSubmenu, setOpenSubmenu] = useState<string | undefined>()
  const closeSubmenu = () => {
    setOpenSubmenu(undefined)
  }

  const { hasIcon, columns } = getMenuColumnFlags(menuItems)

  const sortedItems = menuItems.toSorted(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  )

  return (
    <>
      {sortedItems.map((item, idx) => {
        if ('subMenu' in item) {
          const key = submenuKey(item.label)
          return (
            <CascadingSubmenu
              key={key}
              item={item}
              inset={hasIcon && !item.icon}
              columns={columns}
              onMenuItemClick={onMenuItemClick}
              closeAfterItemClick={closeAfterItemClick}
              onCloseRoot={onCloseRoot}
              onNavigateBack={onNavigateBack}
              zIndex={zIndex}
              isOpen={openSubmenu === key && !item.disabled}
              onOpen={() => {
                if (!item.disabled) {
                  setOpenSubmenu(key)
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
            <ListSubheader
              key={`subHeader-${item.label}`}
              className={classes.subHeader}
              // a leading subHeader has no rows above it to divide from, so drop
              // the divider rule that would otherwise float at the menu's top edge
              sx={idx === 0 ? { borderTop: 'none', marginTop: 0 } : undefined}
            >
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
            columns={columns}
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
  onMenuItemClick: (callback: MenuItemClickHandler) => void
  closeAfterItemClick?: boolean
  menuItems: MenuItemsGetter
  open: boolean
  onClose: () => void
  anchorEl?: Element | null
  anchorOrigin?: PopoverOrigin
  transformOrigin?: PopoverOrigin
  anchorReference?: 'anchorEl' | 'anchorPosition' | 'none'
  anchorPosition?: { top: number; left: number }
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
      style={style}
    >
      <CascadingMenuList
        menuItems={items}
        closeAfterItemClick={closeAfterItemClick}
        onMenuItemClick={onMenuItemClick}
        onCloseRoot={onClose}
        zIndex={style?.zIndex}
      />
    </Menu>
  )
})

export default CascadingMenu
