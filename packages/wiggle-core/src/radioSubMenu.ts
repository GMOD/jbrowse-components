import type { MenuItem } from '@jbrowse/core/ui'

/**
 * Build a radio submenu from a `[value, label]` option table keyed on the
 * current `value`. Lets a display keep one option table as the single source of
 * truth for both its config enumeration and its track menu, so the two can't
 * drift. Shared by the wiggle rendering-type menu and the MAF per-row identity
 * menu; generic over the value's string-literal union. `extraItems` are appended
 * after the radios (e.g. a related checkbox) within the same submenu.
 */
export function makeRadioSubMenu<T extends string>(opts: {
  label: string
  value: T
  onChange: (value: T) => void
  options: readonly (readonly [T, string])[]
  extraItems?: MenuItem[]
}): MenuItem {
  const { label, value, onChange, options, extraItems = [] } = opts
  return {
    label,
    subMenu: [
      ...options.map(([optionValue, optionLabel]) => ({
        label: optionLabel,
        type: 'radio' as const,
        checked: value === optionValue,
        onClick: () => {
          onChange(optionValue)
        },
      })),
      ...extraItems,
    ],
  }
}
