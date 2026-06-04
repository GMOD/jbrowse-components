import type { CheckboxMenuItem, RadioMenuItem } from '@jbrowse/core/ui'

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
    onClick: () => {
      setMode(value)
    },
  }))
}

export function checkboxItem(
  label: string,
  checked: boolean,
  onToggle: () => void,
  opts?: {
    helpText?: string
    icon?: CheckboxMenuItem['icon']
    disabled?: boolean
  },
): CheckboxMenuItem {
  return {
    label,
    type: 'checkbox',
    checked,
    onClick: () => {
      onToggle()
    },
    ...opts,
  }
}

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
