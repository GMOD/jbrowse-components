import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'

// Neither helper sets `keepMenuOpen`: `CascadingMenu` keeps a checkbox/radio row
// open by its type (`staysOpenOnClick`), so a settings row states nothing and a
// hand-written literal behaves identically — which is what stops a new menu from
// regressing by omission, the way MAF's "Show..." menu did. The flag is left for
// the rows that genuinely dismiss (a dialog opener passes `keepMenuOpen: false`).
//
// The promotable variants (a trailing pin that sets the display-type default)
// live in `promotableMenuItems.tsx`; reach for those when the setting has a
// `DisplayTypeDefaultControl`.

export function checkboxItem(
  label: string,
  checked: boolean,
  onToggle: () => void,
  // `subLabel` renders inline under the label; `helpText` claims a "?" column
  // that `getMenuColumnFlags` then reserves on EVERY row of the menu, so prefer
  // a subLabel for a short clarifier and keep helpText for real prose.
  // `keepMenuOpen: false` is for a checkbox whose click opens a dialog.
  opts?: {
    helpText?: string
    subLabel?: string
    disabled?: boolean
    disabledHelpText?: string
    keepMenuOpen?: boolean
  },
): CheckboxMenuItem {
  return {
    label,
    type: 'checkbox',
    checked,
    onClick: onToggle,
    ...opts,
  }
}

export function radioItems<T extends string>(
  options: readonly {
    value: T
    label: string
    subLabel?: string
    helpText?: string
  }[],
  current: T | undefined,
  setMode: (m: T) => void,
): RadioMenuItem[] {
  return options.map(({ value, label, subLabel, helpText }) => ({
    label,
    subLabel,
    helpText,
    type: 'radio' as const,
    checked: current === value,
    onClick: () => {
      setMode(value)
    },
  }))
}
