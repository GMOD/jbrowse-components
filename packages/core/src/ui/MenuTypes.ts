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
   * Keep the menu open after this row is clicked, instead of dismissing it.
   * Opt-in per item (the menu still closes on every other row) so settings
   * toggles — radios/checkboxes the user may flip several of in one session —
   * stay put, while terminal actions (dialogs, exports, navigation) close as
   * usual. The menu content is an observer, so the open menu updates its
   * checked marks live.
   */
  keepMenuOpen?: boolean
  /**
   * Extra content rendered at the trailing (right) edge of the row, after the
   * checkbox/radio decoration and help icon — e.g. a secondary toggle. The
   * content must `stopPropagation` on its own click so it doesn't fire the row's
   * onClick or dismiss the menu.
   */
  endAdornment?: React.ReactNode
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

// A clickable row: what remains once divider/subHeader/subMenu/custom items are
// handled — a plain action, or a checkbox/radio carrying a checked value.
export type ClickableMenuItem =
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem

export type MenuItem =
  | MenuDivider
  | MenuSubHeader
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem
  | SubMenuItem
  | CustomMenuItem

export type MenuItemsGetter = MenuItem[] | (() => MenuItem[])
