/** #menuItem divider | a horizontal rule; not clickable */
export interface MenuDivider {
  priority?: number
  type: 'divider'
}

/** #menuItem subHeader | a text label for a section of a menu; not clickable */
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
  /** #menuField stable identifier, for tests and for finding a row again */
  id?: string
  /** #menuField the row's text */
  label: React.ReactNode
  /** #menuField sort weight within the menu; higher sorts earlier */
  priority?: number
  /**
   * #menuField secondary text under the label; prefer `withHint` in the label
   *
   * Renders as a second line under the label, which makes the row two lines
   * tall. Nothing in this repo uses it any more: a menu whose rows are each two
   * lines is harder to scan than the labels it buried, so a short clarifier
   * goes in the label (`withHint` where it is conditional) and real prose goes
   * in `helpText`. Kept because it renders and plugins may pass one.
   */
  subLabel?: string
  /** #menuField any [MUI icon](https://mui.com/material-ui/material-icons/) component */
  icon?: React.ElementType
  /** #menuField renders the row unclickable */
  disabled?: boolean
  /** #menuField tooltip shown from a help icon at the trailing edge */
  helpText?: string
  /** #menuField tooltip shown when the item is disabled, in place of helpText */
  disabledHelpText?: string
  /**
   * #menuField override the dismiss-on-click rule; see `staysOpenOnClick`
   *
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
   * #menuField arbitrary trailing content
   *
   * Extra content rendered at the trailing (right) edge of the row, after the
   * checkbox/radio decoration and help icon — e.g. a secondary toggle. The
   * content must `stopPropagation` on its own click so it doesn't fire the row's
   * onClick or dismiss the menu.
   *
   * An **element**, so a module that sets it drags React and whatever it renders
   * into its own graph. Reach for it only when the content is genuinely
   * arbitrary — synteny's and wiggle's colour swatches are what it exists for.
   */
  endAdornment?: React.ReactNode
}

/** #menuItem normal | an action row; the default when `type` is omitted */
export interface NormalMenuItem extends BaseMenuItem {
  type?: 'normal'
  onClick: MenuItemClickHandler
}

/** #menuItem checkbox | a setting row with a checkbox; leaves the menu open */
export interface CheckboxMenuItem extends BaseMenuItem {
  type: 'checkbox'
  checked: boolean
  onClick: MenuItemClickHandler
}

/** #menuItem radio | a setting row with a radio button; leaves the menu open */
export interface RadioMenuItem extends BaseMenuItem {
  type: 'radio'
  checked: boolean
  onClick: MenuItemClickHandler
}

/**
 * #menuItem subMenu | nests another `MenuItem[]`, or a function building one, to any depth
 *
 * The function form is called when the submenu opens (or a walker asks for its
 * rows), not when the parent menu is built — for a submenu whose rows cost a
 * scan of the display's data to name. Read the field through `resolveSubMenu`
 * rather than by hand, so the two forms stay one thing to the renderer and to
 * every test helper that flattens a menu.
 */
export interface SubMenuItem extends BaseMenuItem {
  type?: 'subMenu'
  subMenu: MenuItem[] | (() => MenuItem[])
}

export function resolveSubMenu(item: SubMenuItem) {
  return typeof item.subMenu === 'function' ? item.subMenu() : item.subMenu
}

/**
 * #menuItem custom | renders arbitrary React content inline, e.g. a slider
 *
 * The menu is not dismissed when interacting with it, so a control can be
 * dragged live; `onClose` is passed for content that wants to close the menu
 * explicitly. `label` is used only as a React key/testid.
 */
export interface CustomMenuItem extends BaseMenuItem {
  type: 'custom'
  render: (onClose: () => void) => React.ReactNode
}

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
