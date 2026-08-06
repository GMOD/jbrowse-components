import type { DisplayTypeDefaultControl } from '../configuration/promotableDefaults.ts'

// #region menuItem
export interface MenuDivider {
  priority?: number
  type: 'divider'
}

export interface MenuSubHeader {
  type: 'subHeader'
  priority?: number
  label: string
}

// onClick receives a context argument (e.g. the session or track-selector
// model) whose concrete type varies by where the item is registered, while the
// renderer invokes it with no argument. A single `MenuItem[]` array can hold
// handlers expecting different context types, so the parameter list stays `any`
// rather than a generic that callers would have to cast through.
export type MenuItemClickHandler = (...args: any[]) => void

export interface BaseMenuItem {
  id?: string
  label: React.ReactNode
  priority?: number
  subLabel?: string
  icon?: React.ElementType
  disabled?: boolean
  helpText?: string
  /** tooltip shown when the item is disabled, in place of helpText */
  disabledHelpText?: string
  /**
   * Override whether the menu stays open after this row is clicked. Leave it
   * unset and the row TYPE decides: a `checkbox`/`radio` is a setting, so the
   * menu stays put (users flip several in one visit, and the menu content is an
   * observer, so its checked marks update live), while every other row is an
   * action and dismisses.
   *
   * Set `false` on a checkbox/radio whose click is really terminal — it opens a
   * dialog ("Custom...", "Solid color...") or swaps the display out from under
   * the menu. Set `true` on a non-checkbox row that should survive its click.
   */
  keepMenuOpen?: boolean
  /**
   * Extra content rendered at the trailing (right) edge of the row, after the
   * checkbox/radio decoration and help icon — e.g. a secondary toggle. The
   * content must `stopPropagation` on its own click so it doesn't fire the row's
   * onClick or dismiss the menu.
   *
   * An **element**, so a module that sets it drags React and whatever it renders
   * into its own graph. That is fine for the one-off it exists for (synteny's
   * color swatch) and wrong for the common case, which is why the pin below is
   * a description instead. Prefer `defaultForAll`; reach for this only when the
   * content is genuinely arbitrary.
   */
  endAdornment?: React.ReactNode
  /**
   * The trailing "default for all tracks of this type" pin, as a **description**
   * rather than an element — the renderer builds `DefaultForAllAdornment` from
   * it. Same rule as a `TrackControlProps` icon name (reference/DISPLAYCHROME.md):
   * menu-item builders are called from state models and menu modules, which are
   * eager, so an element here puts MUI's `ToggleButton`, `Tooltip` and two icons
   * into every host's first paint. It did, until 2026-08-05; see
   * reference/EAGER_BUNDLE.md.
   *
   * Set it through `promotableToggleItem`/`promotableRadioItem`, not by hand.
   *
   * A `type: 'custom'` row (`makePromotableSizeMenu`) draws its own pin inside
   * its rendered content and still sets this — the declaration is what lets a
   * built menu be asked which promotable slots it offers a pin for at all. Such
   * a row is excluded from the trailing-column reservation; see
   * `hasMenuItemAdornment`.
   */
  defaultForAll?: MenuItemDefaultForAll
}

export interface MenuItemDefaultForAll {
  control: DisplayTypeDefaultControl
  /**
   * Names the setting in the pin's tooltip and aria-label. Carried here rather
   * than read off the row's `label`, which is a `ReactNode` and may not be a
   * string; a pin that can't name what it promotes reads as a bug.
   */
  label: string
}

export interface NormalMenuItem extends BaseMenuItem {
  type?: 'normal'
  onClick: MenuItemClickHandler
}

export interface CheckboxMenuItem extends BaseMenuItem {
  type: 'checkbox'
  checked: boolean
  onClick: MenuItemClickHandler
}

export interface RadioMenuItem extends BaseMenuItem {
  type: 'radio'
  checked: boolean
  onClick: MenuItemClickHandler
}

export interface SubMenuItem extends BaseMenuItem {
  type?: 'subMenu'
  subMenu: MenuItem[]
}

// Renders arbitrary React content inline in the menu (e.g. a slider) instead of
// a clickable row. The menu is not dismissed when interacting with it, so a
// control can be dragged live; `onClose` is passed for content that wants to
// close the menu explicitly. `label` is used only as a React key/testid.
export interface CustomMenuItem extends BaseMenuItem {
  type: 'custom'
  render: (onClose: () => void) => React.ReactNode
}
// #endregion

// A clickable row: what remains once divider/subHeader/subMenu/custom items are
// handled — a plain action, or a checkbox/radio carrying a checked value.
export type ClickableMenuItem =
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem

// #region menuItemUnion
export type MenuItem =
  | MenuDivider
  | MenuSubHeader
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem
  | SubMenuItem
  | CustomMenuItem
// #endregion

/**
 * Whether clicking a row leaves the menu up — the rule `CascadingMenu` applies,
 * exported so a display's menu-shape test asserts the behavior a user gets
 * rather than re-deriving it from the flag (each test that spelled out
 * `keepMenuOpen === true` had to be revisited when the default moved here).
 *
 * Defaulted by row TYPE: a checkbox/radio is a setting and stays put, every
 * other row is an action and dismisses. `keepMenuOpen` overrides either way.
 */
export function staysOpenOnClick(item: ClickableMenuItem) {
  return (
    item.keepMenuOpen ?? (item.type === 'checkbox' || item.type === 'radio')
  )
}

export type MenuItemsGetter = MenuItem[] | (() => MenuItem[])
