import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'

// Both helpers only write a setting, so they `keepMenuOpen` — users flip
// several in one visit and a track menu is an observer, so the ticks move live.
// Dialog openers (Tag..., Custom...) are written at their call site and still
// dismiss. Going through these rather than a `{ type: 'checkbox' }` literal is
// what keeps that behavior uniform across displays: MAF's "Show..." menu shut
// itself after every toggle for exactly as long as it spelled its rows by hand.
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
