import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'

// Neither helper sets `keepMenuOpen`: `CascadingMenu` keeps a checkbox/radio row
// open by its type (`staysOpenOnClick`), so a settings row states nothing and a
// hand-written literal behaves identically — which is what stops a new menu from
// regressing by omission, the way MAF's "Show..." menu did. The flag is left for
// the rows that genuinely dismiss (a dialog opener passes `keepMenuOpen: false`).
//
// The promotable variants (a trailing pin that sets the display-type default)
// live in `promotableMenuItems.ts`; reach for those when the setting has a
// `Pin`.

// The row decorations no builder here decides for itself. `helpText` claims a
// "?" column that `getMenuColumnFlags` then reserves on EVERY row of the menu,
// so it is for real prose worth that cost. `subLabel` renders inline under the
// label and is NOT the answer to a short clarifier: a menu whose rows are each
// two lines tall is harder to scan than the labels it buried. Put a short
// clarifier in the label -- `withHint` for a conditional one.
// `keepMenuOpen: false` is for a settings row whose click opens a dialog.
//
// One bag for both row kinds, named rather than inlined, because each
// promotable builder builds its row *through* the plain one here and has to
// offer the same set — spelling it twice is how the two drifted, the promotable
// checkbox silently lacking `disabled` and the promotable radio the same three.
export interface SettingRowOptions {
  helpText?: string
  disabled?: boolean
  disabledHelpText?: string
  keepMenuOpen?: boolean
}

/**
 * A label plus a parenthetical that is only sometimes there: `withHint('Show
 * row separators', tooShort ? 'needs rows 4px or taller' : undefined)`.
 *
 * The rows that want this are the ones that can be on, correctly on, and doing
 * nothing observable -- a band overridden by the summary tier, a separator
 * below the height it draws at. The tick keeps reporting what the user chose,
 * so silence would leave the setting looking broken.
 *
 * IN THE LABEL rather than a `subLabel`, which is what these were: a second
 * line under the row is heavy for a clarifier this short, and rather than a
 * `helpText`, which would reserve a "?" column across the whole menu for one
 * conditional row and hide the reason behind a hover -- on a control the reader
 * has no reason to hover, since from the tick it looks like it already works.
 */
export function withHint(label: string, hint: string | undefined) {
  return hint ? `${label} (${hint})` : label
}

/** #menuBuilder checkboxItem | one checkbox setting row */
export function checkboxItem(
  label: string,
  checked: boolean,
  onToggle: () => void,
  opts?: SettingRowOptions,
): CheckboxMenuItem {
  return {
    label,
    type: 'checkbox',
    checked,
    onClick: onToggle,
    ...opts,
  }
}

/**
 * #menuBuilder toggleItem | a checkbox row whose setter takes the new value
 *
 * `checkboxItem` where the callback is handed the value rather than left to
 * derive it. Prefer this: the derivation is `!` applied to the same expression
 * the row is `checked` by, and writing it out per row is 38 chances to negate
 * the wrong thing — which fails as a checkbox that ticks and does nothing, with
 * nothing thrown.
 *
 * It is also the shape `radioItems` already takes (`setMode: (m: T) => void`),
 * so the two group builders now agree about who computes the new value.
 *
 * MAF had this as a local wrapper, and it had already lost most of
 * `SettingRowOptions` to a hand-narrowed one-field bag — the exact drift the
 * comment on that interface warns about.
 */
export function toggleItem(
  label: string,
  value: boolean,
  setValue: (value: boolean) => void,
  opts?: SettingRowOptions,
): CheckboxMenuItem {
  return checkboxItem(
    label,
    value,
    () => {
      setValue(!value)
    },
    opts,
  )
}

// One radio row. The singular of `radioItems`, and what
// `promotableRadioItem` builds through, so a lone radio row and a member of a
// group are the same object plus or minus its pin.
/** #menuBuilder radioItem | one radio setting row; the singular of `radioItems` */
export function radioItem(
  label: string,
  checked: boolean,
  onClick: () => void,
  opts?: SettingRowOptions,
): RadioMenuItem {
  return {
    label,
    type: 'radio',
    checked,
    onClick,
    ...opts,
  }
}

// One option of a radio group. Exported so `promotableRadioItems` can take the
// same array this does and hand it straight through.
export interface RadioOption<T extends string> {
  value: T
  label: string
  helpText?: string
}

/** #menuBuilder radioItems | a radio group, one row per option */
export function radioItems<T extends string>(
  options: readonly RadioOption<T>[],
  current: T | undefined,
  setMode: (m: T) => void,
): RadioMenuItem[] {
  return options.map(({ value, label, ...opts }) =>
    radioItem(
      label,
      current === value,
      () => {
        setMode(value)
      },
      opts,
    ),
  )
}
