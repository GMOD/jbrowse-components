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

// The row decorations no builder here decides for itself. `subLabel` renders
// inline under the label; `helpText` claims a "?" column that
// `getMenuColumnFlags` then reserves on EVERY row of the menu, so prefer a
// subLabel for a short clarifier and keep helpText for real prose.
// `keepMenuOpen: false` is for a settings row whose click opens a dialog.
//
// One bag for both row kinds, named rather than inlined, because each
// promotable builder builds its row *through* the plain one here and has to
// offer the same set — spelling it twice is how the two drifted, the promotable
// checkbox silently lacking `disabled` and the promotable radio the same three.
export interface SettingRowOptions {
  helpText?: string
  subLabel?: string
  disabled?: boolean
  disabledHelpText?: string
  keepMenuOpen?: boolean
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
  subLabel?: string
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
