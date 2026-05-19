import type {
  ArcDirection,
  LinkedReadsMode,
} from '../../LinearAlignmentsDisplay/constants.ts'

// Single home for each mode-enum's user-visible labels, so menu code never
// has to reverse-engineer a label from the stored value.
export const ARC_DIRECTION_OPTIONS: { value: ArcDirection; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'up', label: 'Pointing up' },
  { value: 'down', label: 'Pointing down' },
]

export const LINKED_READS_OPTIONS: {
  value: LinkedReadsMode
  label: string
}[] = [
  { value: 'off', label: 'Off' },
  { value: 'normal', label: 'Normal' },
  { value: 'bezier', label: 'Bezier' },
]

// Build a radio-style submenu from an (value, label) options list and an
// enum-typed setter. Reusable across all linked-reads / arc-direction
// pickers.
export function radioModeSubMenu<T extends string>(
  options: { value: T; label: string }[],
  current: T,
  setMode: (m: T) => void,
) {
  return options.map(({ value, label }) => ({
    label,
    type: 'radio' as const,
    checked: current === value,
    onClick: () => {
      setMode(value)
    },
  }))
}
