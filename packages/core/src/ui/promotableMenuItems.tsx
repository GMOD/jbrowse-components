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
// slot). EVERY option in a group gets a pin, the `promotedBase` value included:
// once a non-base value is promoted, pinning the base back is the only per-value
// way to undo it from its own row, and a radio group with one row silently
// missing its trailing control reads as a bug. `displayTypeDefault` stays
// optional only for a row that has no single value to promote yet (the colorBy
// "Tag..." row before a tag is picked) or a display whose slot isn't promotable
// at all (the shared colorBy menu on gwas/variants).
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
