import type { LinkedReadsMode } from '../constants.ts'

export const LINKED_READS_OPTIONS: {
  value: LinkedReadsMode
  label: string
}[] = [
  { value: 'off', label: 'Off' },
  { value: 'normal', label: 'Normal' },
  { value: 'bezier', label: 'Bezier' },
]

// Top-level submenu item holding a radio-mode picker: maps an (value, label)
// options list and an enum-typed setter to a {label, type:'subMenu', subMenu}
// shape so callers stay one-liners.
export function radioModeMenuItem<T extends string>(
  label: string,
  options: { value: T; label: string }[],
  current: T,
  setMode: (m: T) => void,
) {
  return {
    label,
    type: 'subMenu' as const,
    subMenu: options.map(({ value, label }) => ({
      label,
      type: 'radio' as const,
      checked: current === value,
      onClick: () => {
        setMode(value)
      },
    })),
  }
}
