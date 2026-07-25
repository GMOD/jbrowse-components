import type { CheckboxMenuItem, RadioMenuItem } from '@jbrowse/core/ui'

// Callers hold `noun` lower-case because it also appears mid-sentence
// ("Longest reads first"); menu labels lead with a capital.
export function capitalizeFirst(s: string) {
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

// Both helpers only write a setting, so they `keepMenuOpen` — users flip several
// in one visit and the menu is an observer, so the ticks move live. Dialog
// openers (Tag..., Custom...) are written at their call site and still dismiss.

export function radioItems<T extends string>(
  options: { value: T; label: string; subLabel?: string; helpText?: string }[],
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

export function checkboxItem(
  label: string,
  checked: boolean,
  onToggle: () => void,
  opts?: { helpText?: string },
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
