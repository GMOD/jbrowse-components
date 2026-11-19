import { createContext, use, useEffect, useMemo, useState } from 'react'

import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import {
  CascadingMenuContext,
  useAboveMenuZIndex,
  useCascadingMenu,
} from './CascadingMenuContext.ts'
import CascadingMenuHelpDialog from './CascadingMenuHelpDialog.tsx'
import HoverMenu from './HoverMenu.tsx'
import MaybeTooltip from './MaybeTooltip.tsx'
import { MenuItemTrailing } from './MenuItemTrailing.tsx'
import { resolveSubMenu, staysOpenOnClick } from './MenuTypes.ts'
import { hasMenuItemAdornment } from './menuItemAdornment.ts'
import { isAimedAtPanel } from './submenuAim.ts'
import { submenuOrigins, submenuSide } from './submenuSide.ts'
import { HELP_ROW_TESTID, usePlacedMenuFocus } from './usePlacedMenuFocus.ts'

import type { MenuHelpEntry } from './CascadingMenuHelpDialog.tsx'
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
import type { SubmenuSide } from './submenuSide.ts'
import type { PopoverOrigin } from '@mui/material'

export type { MenuItemsGetter } from './MenuTypes.ts'

// Compact section headers so tall menus (e.g. a display's flat "Show"
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
  // a leading subHeader has no rows above it to divide from, so the rule and
  // its space would float against the menu's top edge
  leadingSubHeader: {
    borderTopWidth: 0,
    marginTop: 0,
  },
}))

const SubmenuSideContext = createContext<SubmenuSide>('right')

/**
 * How long a change deferred by the aim cone waits before it happens anyway.
 *
 * Only a pointer INSIDE the cone is ever deferred, and every further move
 * inside it re-arms this — so it expires only once the pointer has stopped
 * while still aimed at the panel, which is someone who set out for the submenu
 * and changed their mind. A pointer that keeps traveling reaches the panel; one
 * that veers off leaves the cone and is acted on at once. That is what lets
 * this be short: it is a backstop for a stalled pointer, not the mechanism.
 *
 * Read it as the pause budget, because that is what it is once the cone is
 * doing the work: whoever changes it is choosing how long a pointer may stop
 * part way to a submenu before losing it, not how fast the menu answers. The
 * paths a user feels as slow — veering off, heading straight down the list —
 * never reach this timer at all.
 *
 * What stops it going shorter still is that a moving pointer re-arms it from
 * mousemove, and mousemove stops arriving while the main thread is busy — a
 * track finishing a fetch and repainting behind the menu is enough. Below the
 * length of a stall like that, the panel would close under a pointer that never
 * paused, which is the bug this whole mechanism exists to prevent, arriving by
 * a different route. The cone is what made the number small; it cannot make it
 * zero.
 */
const submenuAimGraceMs = 120

/**
 * The hover intent that moves which submenu of ONE list is open.
 *
 * A click or ArrowRight says where the pointer meant to go and acts at once. A
 * hover is read against {@link isAimedAtPanel}: outside the cone it acts at
 * once too, and inside it defers, because the rows between a submenu row and
 * its panel are exactly the ones a pointer on its way there has to cross.
 *
 * Built once per list, so every row gets the same handlers and a row whose
 * open state didn't change skips the re-render a hover triggers.
 */
function createSubmenuHover(setOpenSubmenu: (key: string | undefined) => void) {
  let openKey: string | undefined
  // the open panel's paper, so the cone has a real edge to open onto. Written
  // by whichever CascadingSubmenu is open and cleared as it closes, so at most
  // one submenu of this list ever owns it
  const panelRef: React.RefObject<HTMLElement | null> = { current: null }
  // where the pointer was when the open panel opened — the cone's tip
  let apex: AimPoint | undefined
  // where the pointer last was while a panel is up. A row that slides under a
  // resting pointer — the menu grew a fetch later and MUI moved it back into
  // the viewport, or rows landed above — gets a mouseenter at that same point,
  // and it is the layout that moved, not the pointer, so it is no hover.
  let lastPoint: AimPoint | undefined
  let pending:
    | {
        key: string | undefined
        point: AimPoint
        timer: ReturnType<typeof setTimeout>
      }
    | undefined

  const cancelPending = () => {
    if (pending) {
      clearTimeout(pending.timer)
      pending = undefined
    }
  }

  const commit = (key: string | undefined, point?: AimPoint) => {
    cancelPending()
    apex = key === undefined ? undefined : point
    lastPoint = point
    openKey = key
    setOpenSubmenu(key)
  }

  const restingUnderOpenPanel = (point: AimPoint) =>
    openKey !== undefined &&
    lastPoint !== undefined &&
    point.x === lastPoint.x &&
    point.y === lastPoint.y

  // 'unmeasured' is its own answer, not a lenient 'inside': a cone pointing at
  // nothing would call every row crossed a veer-off, and a move handler that
  // re-armed on it would hold the panel open for as long as the pointer kept
  // moving anywhere at all
  const aimAt = (point: AimPoint) => {
    const panel = panelRef.current
    if (!panel || !apex) {
      return 'unmeasured' as const
    }
    const rect = panel.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      return 'unmeasured' as const
    }
    return isAimedAtPanel(point, apex, rect) ? ('inside' as const) : 'outside'
  }

  const defer = (key: string | undefined, point: AimPoint) => {
    cancelPending()
    pending = {
      key,
      point,
      timer: setTimeout(() => {
        commit(key, point)
      }, submenuAimGraceMs),
    }
  }

  // the pointer arrived at a row wanting `key` open — undefined from a row with
  // no submenu, i.e. "close whatever is"
  const hoverSubmenu = (key: string | undefined, point: AimPoint) => {
    if (key === openKey) {
      cancelPending()
    } else if (restingUnderOpenPanel(point)) {
      return
    } else if (openKey === undefined || aimAt(point) === 'outside') {
      // nothing to protect, or a pointer that was never heading for the open
      // panel: either way there is nothing to wait for
      commit(key, point)
    } else {
      defer(key, point)
    }
  }

  return {
    panelRef,
    setSubmenu: commit,
    cancelPending,
    hoverSubmenu,
    // every row a pointer can rest on asks for the open panel to go away; only
    // a row that owns a submenu, or the panel itself, keeps one up
    closeOnHover: (event: React.MouseEvent) => {
      hoverSubmenu(undefined, { x: event.clientX, y: event.clientY })
    },
    // Watched only while a panel is up, and only a deferred change is waiting
    // on it. A row's own hover cannot answer this alone: the pointer can leave
    // the cone without ever crossing into another row, by turning around inside
    // the one it is already on.
    onPointerMove: (event: MouseEvent) => {
      lastPoint = { x: event.clientX, y: event.clientY }
      const deferred = pending
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
    },
  }
}

type SubmenuHover = ReturnType<typeof createSubmenuHover>

function useSubmenuHover() {
  const [openSubmenu, setOpenSubmenu] = useState<string | undefined>()
  const [hover] = useState(() => createSubmenuHover(setOpenSubmenu))
  useEffect(() => hover.cancelPending, [hover])
  useEffect(() => {
    if (openSubmenu === undefined) {
      return
    }
    document.addEventListener('mousemove', hover.onPointerMove)
    return () => {
      document.removeEventListener('mousemove', hover.onPointerMove)
    }
  }, [openSubmenu, hover])
  return { openSubmenu, hover }
}

// One key per row, unique WITHIN the level — the React key, and for a submenu row
// also the identity of "which submenu is open".
//
// A row is named by its `id`, or by its label where it has none. Deliberately not
// the array index: the items are re-derived on every observable change (a checkbox
// toggle can add or drop a row above), so an index-keyed "open" flag would follow
// the position rather than the submenu and the open panel would jump to whichever
// row landed at that index.
//
// A NAME THAT REPEATS TAKES AN OCCURRENCE SUFFIX, so the level's keys are unique
// whatever its rows are called. Two ways a name repeats, and both shipped: a
// `label` is a `React.ReactNode`, so an element interpolates to `[object Object]`
// and a menu of them named every row the same — the favorites and recently-used
// track dropdowns did — and a label can simply be shared, since a list may dedupe
// on something other than its text, as the recent locations dedupe on the
// location. Handling it here rather than asking every caller for an `id` means
// neither case can reach React as one key for several rows; only the rows that
// genuinely repeat depend on their order among each other, and `id` is then a way
// to keep a row's identity across a reorder rather than a correctness obligation.
//
// The kind prefix is the render branch below: a submenu row and a clickable row
// sharing a label draw different components, which must not share a key.
function rowKeys(items: JBMenuItem[]) {
  const seen = new Map<string, number>()
  return items.map(item => {
    const kind =
      'subMenu' in item
        ? 'subMenu'
        : item.type === 'divider' || item.type === 'subHeader'
          ? item.type
          : item.type === 'custom'
            ? 'custom'
            : 'menuitem'
    // a divider has no identity beyond its position among the other dividers.
    // `'id' in item` rather than `item.id`: a divider and a subHeader are their
    // own interfaces and carry neither an `id` nor, for the divider, a label
    const name =
      item.type === 'divider'
        ? ''
        : ('id' in item && item.id) || `${item.label}`
    const base = `${kind}-${name}`
    const seenBefore = seen.get(base) ?? 0
    seen.set(base, seenBefore + 1)
    // The count LEADS, and every row carries one. A trailing suffix is drawn
    // from the same alphabet as the label it disambiguates, so `x#1` beside two
    // rows called `x` collided all over again — the second `x` took the first
    // one's key. Leading, the count is the digits before the first `-` and the
    // base is everything after, and `kind` always starts with a letter, so no
    // two (count, base) pairs can spell one key.
    return `${seenBefore}-${base}`
  })
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

function isDisabled(item: JBMenuItem) {
  return 'disabled' in item && !!item.disabled
}

// Leading icon slot shared by submenu rows and clickable rows; renders nothing
// when the item has no icon (the row insets instead to stay column-aligned).
const MenuItemLeadingIcon = observer(function MenuItemLeadingIcon({
  Icon,
}: {
  Icon: React.ElementType | undefined
}) {
  return Icon ? (
    <ListItemIcon>
      <Icon />
    </ListItemIcon>
  ) : null
})

// The level's Help dialog lists its enabled rows' helpText. A submenu row's
// own helpText is the intro of its panel's dialog instead, and a disabled row's
// help is its `disabledHelpText` tooltip.
function menuHelpEntries(items: JBMenuItem[], keys: string[]) {
  return items.flatMap((item, idx): MenuHelpEntry[] =>
    'helpText' in item &&
    item.helpText &&
    !item.disabled &&
    !('subMenu' in item)
      ? [{ key: keys[idx]!, label: item.label, helpText: item.helpText }]
      : [],
  )
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
const CustomMenuRow = observer(function CustomMenuRow({
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
})

// Disabled rows aren't keyboard-focusable, so the span MaybeTooltip wraps a
// disabled row in doesn't affect menu navigation
const DisabledTooltip = observer(function DisabledTooltip({
  item,
  children,
}: {
  item: Pick<BaseMenuItem, 'disabled' | 'disabledHelpText'>
  children: React.ReactElement
}) {
  const zIndex = useAboveMenuZIndex()
  return (
    <MaybeTooltip
      title={item.disabled ? item.disabledHelpText : undefined}
      disabled={item.disabled}
      placement="left"
      zIndex={zIndex}
    >
      {children}
    </MaybeTooltip>
  )
})

// One submenu row: label (with optional leading icon), the same trailing
// decorations a clickable row draws, and the panel it opens. Its own trailing
// adornment (a color swatch, a toggle) stops its own click so using it doesn't
// also open the submenu; its `helpText` opens the panel's Help dialog.
const CascadingSubmenu = observer(function CascadingSubmenu({
  item,
  itemKey,
  inset,
  adornmentColumn,
  open,
  hover,
  onNavigateBack,
}: {
  item: SubMenuItem
  itemKey: string
  inset: boolean
  adornmentColumn: boolean
  open: boolean
  hover: SubmenuHover
  onNavigateBack?: () => void
}) {
  const { zIndex } = useCascadingMenu()
  const parentSide = use(SubmenuSideContext)
  const [side, setSide] = useState(parentSide)
  const [anchorEl, setAnchorEl] = useState<HTMLLIElement | null>(null)

  return (
    <>
      <DisabledTooltip item={item}>
        <MenuItem
          ref={setAnchorEl}
          data-testid={makeTestId('submenu', item.label)}
          disabled={item.disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          // keeps the panel visually attached to the row it hangs off: that
          // row's own hover highlight is gone the moment the pointer moves
          // into the panel. Presentational on a `menuitem` — MUI derives
          // aria-checked from `selected` only for the checkbox/radio roles.
          selected={open}
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
          <MenuItemTrailing item={item} adornmentColumn={adornmentColumn} />
        </MenuItem>
      </DisabledTooltip>
      {open ? (
        <HoverMenu
          anchorEl={anchorEl}
          {...submenuOrigins(side)}
          onPlaced={paper => {
            if (anchorEl) {
              setSide(
                submenuSide(
                  parentSide,
                  anchorEl.getBoundingClientRect(),
                  paper.offsetWidth,
                  window.innerWidth,
                ),
              )
            }
          }}
          zIndex={zIndex}
          // the pointer completed the trip, so drop the close a row it crossed
          // on the way scheduled
          onMouseEnter={hover.cancelPending}
          paperRef={hover.panelRef}
          onClose={() => {
            hover.setSubmenu(undefined)
          }}
        >
          <SubmenuSideContext value={side}>
            <SubMenuList
              item={item}
              onNavigateBack={() => {
                hover.setSubmenu(undefined)
                anchorEl?.focus()
              }}
            />
          </SubmenuSideContext>
        </HoverMenu>
      ) : null}
    </>
  )
})

// Resolves the rows inside the panel, which mounts only while it is open:
// a function-form `subMenu` is not called by listing the parent menu. An
// observer so the observables that builder reads re-render the open panel, the
// way an array built in the root observer's render already did.
const SubMenuList = observer(function SubMenuList({
  item,
  onNavigateBack,
}: {
  item: SubMenuItem
  onNavigateBack: () => void
}) {
  return (
    <CascadingMenuList
      menuItems={resolveSubMenu(item)}
      opener={item}
      onNavigateBack={onNavigateBack}
    />
  )
})

// One clickable menu row: label (with optional leading icon) plus its trailing
// value and adornment decorations.
const CascadingMenuItem = observer(function CascadingMenuItem({
  item,
  inset,
  adornmentColumn,
  onNavigateBack,
  onHover,
}: {
  item: ClickableMenuItem
  inset: boolean
  adornmentColumn: boolean
  onNavigateBack?: () => void
  onHover: (event: React.MouseEvent) => void
}) {
  const { closeAfterItemClick, onMenuItemClick, onCloseRoot } =
    useCascadingMenu()
  return (
    <DisabledTooltip item={item}>
      <MenuItem
        data-testid={makeTestId('menuitem', item.label)}
        disabled={item.disabled}
        // A checkbox or radio row states its own value. The glyph
        // `MenuItemEndDecoration` swaps is an `aria-hidden` icon, so without
        // these a screen reader reads "Curved lines" identically whether the
        // setting is on or off, and a test has no way to ask but the MUI icon's
        // internal testid.
        role={
          item.type === 'checkbox'
            ? 'menuitemcheckbox'
            : item.type === 'radio'
              ? 'menuitemradio'
              : undefined
        }
        aria-checked={
          item.type === 'checkbox' || item.type === 'radio'
            ? item.checked
            : undefined
        }
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
        <MenuItemTrailing item={item} adornmentColumn={adornmentColumn} />
      </MenuItem>
    </DisabledTooltip>
  )
})

// The last row of a level whose rows carry help. The dialog is this row's child,
// so the menu stays open beneath it and focus returns here when it closes.
const CascadingMenuHelpRow = observer(function CascadingMenuHelpRow({
  title,
  intro,
  entries,
  inset,
  onNavigateBack,
  onHover,
}: {
  title?: React.ReactNode
  intro?: string
  entries: MenuHelpEntry[]
  inset: boolean
  onNavigateBack?: () => void
  onHover: (event: React.MouseEvent) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <MenuItem
        data-testid={HELP_ROW_TESTID}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
        onMouseEnter={onHover}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') {
            e.stopPropagation()
            onNavigateBack?.()
          }
        }}
      >
        <ListItemText primary="Help" inset={inset} />
      </MenuItem>
      {open ? (
        <CascadingMenuHelpDialog
          title={title}
          intro={intro}
          entries={entries}
          onClose={() => {
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
})

const CascadingMenuList = observer(function CascadingMenuList({
  menuItems,
  opener,
  onNavigateBack,
}: {
  menuItems: JBMenuItem[]
  // the submenu row this level is the panel of; undefined at the root
  opener?: SubMenuItem
  // close this menu level and refocus its opener (ArrowLeft); undefined at the
  // root level where there is nothing to go back to
  onNavigateBack?: () => void
}) {
  const { classes, cx } = useStyles()
  const { openSubmenu, hover } = useSubmenuHover()
  const { closeOnHover } = hover

  const hasIcon = menuItems.some(m => 'icon' in m && m.icon)
  // per level, so a submenu's adornments line up among its own rows
  const adornmentColumn = menuItems.some(m => hasMenuItemAdornment(m))
  const sortedItems = useMemo(
    () => menuItems.toSorted((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
    [menuItems],
  )
  // keyed after the sort, so an occurrence suffix counts up the level in the
  // order it is drawn
  const keys = useMemo(() => rowKeys(sortedItems), [sortedItems])
  const helpEntries = menuHelpEntries(sortedItems, keys)
  const intro = opener?.helpText
  const openRow =
    openSubmenu === undefined
      ? undefined
      : sortedItems[keys.indexOf(openSubmenu)]
  if (openSubmenu !== undefined && (!openRow || isDisabled(openRow))) {
    hover.setSubmenu(undefined)
  }

  return (
    <>
      {sortedItems.map((item, idx) => {
        const key = keys[idx]!
        if ('subMenu' in item) {
          return (
            <CascadingSubmenu
              key={key}
              itemKey={key}
              item={item}
              inset={hasIcon && !item.icon}
              adornmentColumn={adornmentColumn}
              open={openSubmenu === key}
              hover={hover}
              onNavigateBack={onNavigateBack}
            />
          )
        }
        if (item.type === 'divider') {
          return <Divider key={key} component="li" />
        }
        if (item.type === 'subHeader') {
          return (
            <ListSubheader
              key={key}
              className={cx(
                classes.subHeader,
                idx === 0 && classes.leadingSubHeader,
              )}
              onMouseEnter={closeOnHover}
            >
              {item.label}
            </ListSubheader>
          )
        }
        if (item.type === 'custom') {
          return <CustomMenuRow key={key} item={item} onHover={closeOnHover} />
        }

        return (
          <CascadingMenuItem
            key={key}
            item={item}
            inset={hasIcon && !item.icon}
            adornmentColumn={adornmentColumn}
            onNavigateBack={onNavigateBack}
            onHover={closeOnHover}
          />
        )
      })}
      {intro || helpEntries.length ? (
        <CascadingMenuHelpRow
          title={opener?.label}
          intro={intro}
          entries={helpEntries}
          inset={hasIcon}
          onNavigateBack={onNavigateBack}
          onHover={closeOnHover}
        />
      ) : null}
    </>
  )
})

interface CascadingMenuProps {
  onMenuItemClick?: (callback: MenuItemClickHandler) => void
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
  onMenuItemClick = callback => {
    callback()
  },
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
  const { onEntering, ...focus } = usePlacedMenuFocus()

  return (
    <Menu
      {...focus}
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      anchorReference={anchorReference}
      anchorPosition={anchorPosition}
      style={style}
      slotProps={{ transition: { onEntering } }}
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
