import { createContext, use, useEffect, useRef, useState } from 'react'

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
import { useEventCallback } from '../util/useEventCallback.ts'
import HoverMenu from './HoverMenu.tsx'
import { MenuItemTrailing } from './MenuItemTrailing.tsx'
import { staysOpenOnClick } from './MenuTypes.ts'
import { hasMenuItemAdornment } from './menuItemAdornment.tsx'
import { isAimedAtPanel } from './submenuAim.ts'

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
import type { AimPoint } from './submenuAim.ts'
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

/**
 * What every level of one cascading menu shares. A context rather than props
 * because a menu nests to any depth: each level threaded all four down to the
 * next, and a row three levels in needed them only to hand them on again.
 */
interface CascadingMenuShared {
  /** whether clicking a row dismisses the whole menu; see `staysOpenOnClick` */
  closeAfterItemClick: boolean
  /**
   * How a row's onClick is invoked, at every depth — the menu itself never
   * calls it. A caller whose items expect a context argument supplies it here
   * (`cb => { cb(session) }`) rather than rewriting the items to close over it.
   */
  onMenuItemClick: (callback: MenuItemClickHandler) => void
  /** dismisses the root menu, from any depth */
  onCloseRoot: () => void
  /**
   * The root menu's stacking level, carried down to every submenu portal. Each
   * level is its own MUI Menu, so a submenu left on MUI's default modal z-index
   * sits UNDER a root that was raised off that scale (ContextMenu clears the
   * tooltip layer) — and the root's modal spans the viewport, so its backdrop
   * takes every click and hover the submenu rows never see. Undefined leaves
   * MUI's default, which is what a menu opened from a button wants.
   */
  zIndex?: React.CSSProperties['zIndex']
}

const CascadingMenuContext = createContext<CascadingMenuShared | undefined>(
  undefined,
)

function useCascadingMenu() {
  const shared = use(CascadingMenuContext)
  if (!shared) {
    throw new Error('menu row rendered outside a CascadingMenu')
  }
  return shared
}

/**
 * How long a change deferred by the aim cone waits before it happens anyway.
 *
 * Only a pointer INSIDE the cone is ever deferred, and every further move
 * inside it re-arms this — so it expires only once the pointer has stopped
 * while still aimed at the panel, which is someone who set out for the submenu
 * and changed their mind. A pointer that keeps traveling reaches the panel; one
 * that veers off leaves the cone and is acted on at once. That is what lets
 * this be short: it is a backstop for a stalled pointer, not the mechanism.
 */
const submenuAimGraceMs = 200

/**
 * Which submenu of ONE list is open, plus the hover intent that moves it.
 *
 * A click or ArrowRight says where the pointer meant to go and acts at once. A
 * hover is read against {@link isAimedAtPanel}: outside the cone it acts at
 * once too, and inside it defers, because the rows between a submenu row and
 * its panel are exactly the ones a pointer on its way there has to cross.
 */
function useSubmenuHover() {
  const [openSubmenu, setOpenSubmenu] = useState<string | undefined>()
  // the open panel's paper, so the cone has a real edge to open onto. Written
  // by whichever CascadingSubmenu is open and cleared as it closes, so at most
  // one submenu of this list ever owns it
  const panelRef = useRef<HTMLElement | null>(null)
  // where the pointer was when the open panel opened — the cone's tip
  const apex = useRef<AimPoint | undefined>(undefined)
  const pending = useRef<
    | {
        key: string | undefined
        point: AimPoint
        timer: ReturnType<typeof setTimeout>
      }
    | undefined
  >(undefined)

  const cancelPending = () => {
    if (pending.current) {
      clearTimeout(pending.current.timer)
      pending.current = undefined
    }
  }
  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current.timer)
      }
    },
    [],
  )

  const commit = (key: string | undefined, point?: AimPoint) => {
    cancelPending()
    apex.current = key === undefined ? undefined : point
    setOpenSubmenu(key)
  }

  // 'unmeasured' is its own answer, not a lenient 'inside': a cone pointing at
  // nothing would call every row crossed a veer-off, and a move handler that
  // re-armed on it would hold the panel open for as long as the pointer kept
  // moving anywhere at all
  const aimAt = (point: AimPoint) => {
    const panel = panelRef.current
    const tip = apex.current
    if (!panel || !tip) {
      return 'unmeasured' as const
    }
    const rect = panel.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      return 'unmeasured' as const
    }
    return isAimedAtPanel(point, tip, rect) ? ('inside' as const) : 'outside'
  }

  const defer = (key: string | undefined, point: AimPoint) => {
    cancelPending()
    pending.current = {
      key,
      point,
      timer: setTimeout(() => {
        commit(key, point)
      }, submenuAimGraceMs),
    }
  }

  // Watched only while a panel is up, and only a deferred change is waiting on
  // it. A row's own hover cannot answer this alone: the pointer can leave the
  // cone without ever crossing into another row, by turning around inside the
  // one it is already on.
  const onPointerMove = useEventCallback((event: MouseEvent) => {
    const deferred = pending.current
    if (!deferred) {
      return
    }
    const aim = aimAt({ x: event.clientX, y: event.clientY })
    if (aim === 'outside') {
      commit(deferred.key, deferred.point)
    } else if (aim === 'inside') {
      // still traveling, so the grace starts over — it is there to catch a
      // pointer that stops, and this one has not
      defer(deferred.key, deferred.point)
    }
  })
  useEffect(() => {
    if (openSubmenu === undefined) {
      return
    }
    document.addEventListener('mousemove', onPointerMove)
    return () => {
      document.removeEventListener('mousemove', onPointerMove)
    }
  }, [openSubmenu, onPointerMove])

  return {
    openSubmenu,
    panelRef,
    setSubmenu: commit,
    // the pointer reached the open panel, so whatever was scheduled is stale
    keepSubmenuOpen: cancelPending,
    // the pointer arrived at a row wanting `key` open — undefined from a row
    // with no submenu, i.e. "close whatever is"
    hoverSubmenu: (key: string | undefined, point: AimPoint) => {
      if (key === openSubmenu) {
        cancelPending()
      } else if (openSubmenu === undefined || aimAt(point) === 'outside') {
        // nothing to protect, or a pointer that was never heading for the open
        // panel: either way there is nothing to wait for
        commit(key, point)
      } else {
        defer(key, point)
      }
    },
  }
}

type SubmenuHover = ReturnType<typeof useSubmenuHover>

// Identity of a submenu row, used both as its React key and to remember which
// submenu is open. Deliberately not the array index: the items are re-derived on
// every observable change (a checkbox toggle can add or drop a row above), so an
// index-keyed "open" flag would follow the position rather than the submenu and
// the open panel would jump to whichever row landed at that index.
function submenuKey(label: React.ReactNode) {
  return `subMenu-${label}`
}

// Where the aim cone's tip goes for a submenu opened from the keyboard, which
// has no pointer to put it at: the middle of the row, so a pointer picked up
// afterwards is judged by a cone the same shape hovering the row would have
// given it. The row's leading edge, not its trailing one — a tip level with the
// panel's near edge leaves no gap to open a cone across.
function rowCentre(row: HTMLElement | null) {
  if (!row) {
    return undefined
  }
  const rect = row.getBoundingClientRect()
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }
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
//
// Escape is the exception, and has to be: MUI's Modal reads it off the same
// React tree, so a row that swallowed every key left the menu with no way out
// for anyone whose focus was inside the slider.
function CustomMenuRow({
  item,
  onHover,
}: {
  item: CustomMenuItem
  onHover: (event: React.MouseEvent) => void
}) {
  const { onCloseRoot } = useCascadingMenu()
  return (
    <li
      style={{ padding: '4px 16px' }}
      onMouseEnter={onHover}
      onMouseDown={e => {
        e.stopPropagation()
      }}
      onKeyDown={e => {
        if (e.key !== 'Escape') {
          e.stopPropagation()
        }
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
  itemKey,
  inset,
  columns,
  hover,
  onNavigateBack,
}: {
  item: SubMenuItem
  itemKey: string
  inset: boolean
  columns: MenuColumnFlags
  hover: SubmenuHover
  onNavigateBack?: () => void
}) {
  const { zIndex } = useCascadingMenu()
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)
  // a rebuild can disable the row while its panel is up, and a disabled row has
  // no way left to close it
  const isOpen = hover.openSubmenu === itemKey && !item.disabled

  return (
    <>
      <DisabledTooltip item={item}>
        <MenuItem
          ref={setAnchorEl}
          data-testid={makeTestId('submenu', item.label)}
          disabled={item.disabled}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          // keeps the panel visually attached to the row it hangs off: that
          // row's own hover highlight is gone the moment the pointer moves
          // into the panel. Presentational on a `menuitem` — MUI derives
          // aria-checked from `selected` only for the checkbox/radio roles.
          selected={isOpen}
          onMouseEnter={e => {
            hover.hoverSubmenu(itemKey, { x: e.clientX, y: e.clientY })
          }}
          onClick={e => {
            hover.setSubmenu(itemKey, { x: e.clientX, y: e.clientY })
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowRight') {
              hover.setSubmenu(itemKey, rowCentre(anchorEl))
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
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        zIndex={zIndex}
        // the pointer completed the trip, so drop the close a row it crossed on
        // the way scheduled
        onMouseEnter={hover.keepSubmenuOpen}
        // only while open: a panel MUI is still fading out is not something to
        // aim at, and this list keeps one cone target for whichever submenu is
        // up
        paperRef={isOpen ? hover.panelRef : undefined}
        onClose={() => {
          hover.setSubmenu(undefined)
        }}
      >
        <CascadingMenuList
          menuItems={item.subMenu}
          onNavigateBack={() => {
            hover.setSubmenu(undefined)
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
  inset,
  columns,
  onNavigateBack,
  onHover,
}: {
  item: ClickableMenuItem
  inset: boolean
  columns: MenuColumnFlags
  onNavigateBack?: () => void
  onHover: (event: React.MouseEvent) => void
}) {
  const { closeAfterItemClick, onMenuItemClick, onCloseRoot } =
    useCascadingMenu()
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
        onMouseEnter={onHover}
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
          inset={inset}
        />
        <MenuItemTrailing item={item} columns={columns} />
      </MenuItem>
    </DisabledTooltip>
  )
}

function CascadingMenuList({
  menuItems,
  onNavigateBack,
}: {
  menuItems: JBMenuItem[]
  // close this menu level and refocus its opener (ArrowLeft); undefined at the
  // root level where there is nothing to go back to
  onNavigateBack?: () => void
}) {
  const { classes } = useStyles()
  const hover = useSubmenuHover()
  // every row a pointer can rest on asks for the open panel to go away; only a
  // row that owns a submenu, or the panel itself, keeps one up. Whether the ask
  // is granted now or waited out is the aim cone's call, which is why the
  // pointer comes with it
  const closeOnHover = (event: React.MouseEvent) => {
    hover.hoverSubmenu(undefined, { x: event.clientX, y: event.clientY })
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
              itemKey={key}
              item={item}
              inset={hasIcon && !item.icon}
              columns={columns}
              hover={hover}
              onNavigateBack={onNavigateBack}
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
              onMouseEnter={closeOnHover}
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
              onHover={closeOnHover}
            />
          )
        }

        return (
          <CascadingMenuItem
            key={`menuitem-${item.label}`}
            item={item}
            inset={hasIcon && !item.icon}
            columns={columns}
            onNavigateBack={onNavigateBack}
            onHover={closeOnHover}
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
      <CascadingMenuContext
        value={{
          closeAfterItemClick,
          onMenuItemClick,
          onCloseRoot: onClose,
          zIndex: style?.zIndex,
        }}
      >
        <CascadingMenuList menuItems={items} />
      </CascadingMenuContext>
    </Menu>
  )
})

export default CascadingMenu
