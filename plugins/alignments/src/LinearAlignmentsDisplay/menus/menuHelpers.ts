import type { LinkedReadsMode } from '../constants.ts'
import type { RadioMenuItem } from '@jbrowse/core/ui'

export const LINKED_READS_OPTIONS: {
  value: LinkedReadsMode
  label: string
}[] = [
  { value: 'off', label: 'Off' },
  { value: 'normal', label: 'Normal' },
  { value: 'bezier', label: 'Bezier' },
]

// Maps an (value, label) options list, a current value, and an enum-typed
// setter to a flat list of radio menu items — the single shape behind every
// "pick one of N" picker in these menus. Use this directly when the radios sit
// inline; wrap with `radioModeMenuItem` when they belong in their own submenu.
export function radioItems<T extends string>(
  options: { value: T; label: string; subLabel?: string }[],
  current: T | undefined,
  setMode: (m: T) => void,
): RadioMenuItem[] {
  return options.map(({ value, label, subLabel }) => ({
    label,
    ...(subLabel ? { subLabel } : {}),
    type: 'radio' as const,
    checked: current === value,
    onClick: () => {
      setMode(value)
    },
  }))
}

// Top-level submenu item holding a radio-mode picker, so callers stay
// one-liners.
export function radioModeMenuItem<T extends string>(
  label: string,
  options: { value: T; label: string }[],
  current: T,
  setMode: (m: T) => void,
) {
  return {
    label,
    type: 'subMenu' as const,
    subMenu: radioItems(options, current, setMode),
  }
}
