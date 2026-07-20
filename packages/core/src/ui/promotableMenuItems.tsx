import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'

import type { DisplayTypeDefaultControl } from '../configuration/promotableDefaults.ts'
import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'

// A promotable setting as one native checkbox menu row: the value toggles the
// track (inheriting native hover/sizing/keyboard), and a trailing pin
// (endAdornment) sets/clears this value as the display type's default. Always
// shown so the capability is discoverable.
export function promotableToggleItem({
  label,
  helpText,
  checked,
  onToggle,
  displayTypeDefault,
  keepMenuOpen,
}: {
  label: string
  helpText?: string
  checked: boolean
  onToggle: () => void
  displayTypeDefault: DisplayTypeDefaultControl
  keepMenuOpen?: boolean
}): CheckboxMenuItem {
  return {
    label,
    helpText,
    type: 'checkbox',
    checked,
    keepMenuOpen,
    onClick: () => {
      onToggle()
    },
    endAdornment: (
      <DefaultForAllAdornment label={label} control={displayTypeDefault} />
    ),
  }
}

// A radio row in a promotable-value group (e.g. one option of a multi-value enum
// slot). `displayTypeDefault` is omitted for the base (inherit) value (e.g. the
// `up`/`normal` base of a mode enum) — only the non-base values are promotable.
export function promotableRadioItem({
  label,
  subLabel,
  helpText,
  checked,
  onClick,
  displayTypeDefault,
  keepMenuOpen,
}: {
  label: string
  subLabel?: string
  helpText?: string
  checked: boolean
  onClick: () => void
  displayTypeDefault?: DisplayTypeDefaultControl
  keepMenuOpen?: boolean
}): RadioMenuItem {
  return {
    label,
    subLabel,
    helpText,
    type: 'radio',
    checked,
    onClick,
    keepMenuOpen,
    ...(displayTypeDefault && {
      endAdornment: (
        <DefaultForAllAdornment label={label} control={displayTypeDefault} />
      ),
    }),
  }
}
