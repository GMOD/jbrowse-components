import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'

// Both helpers only write a setting, so they `keepMenuOpen` — users flip
// several in one visit and a track menu is an observer, so the ticks move live.
// Dialog openers (Tag..., Custom...) are written at their call site and pass
// `keepMenuOpen: false` to dismiss.
//
// `CascadingMenu` now derives the same answer from the row type, so a
// hand-written `{ type: 'checkbox' }` literal behaves identically and can't
// regress by omission the way MAF's "Show..." menu did. These helpers still say
// it outright: the flag is the row's stated intent, which a display's menu-shape
// test can assert without rendering.
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
  opts?: {
    helpText?: string
    subLabel?: string
    disabled?: boolean
    disabledHelpText?: string
  },
): CheckboxMenuItem {
  return {
    label,
    type: 'checkbox',
    checked,
    keepMenuOpen: true,
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
    keepMenuOpen: true,
    onClick: () => {
      setMode(value)
    },
  }))
}
