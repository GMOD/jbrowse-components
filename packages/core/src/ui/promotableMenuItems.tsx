import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'

import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'
import type { SessionDefaultControl } from '../configuration/promotableDefaults.ts'

// A promotable setting as one native checkbox menu row: the value toggles the
// track (inheriting native hover/sizing/keyboard), and a trailing pin
// (endAdornment) sets/clears this value as the display type's default. Always
// shown so the capability is discoverable.
export function promotableToggleItem({
  label,
  helpText,
  checked,
  onToggle,
  sessionDefault,
}: {
  label: string
  helpText?: string
  checked: boolean
  onToggle: () => void
  sessionDefault: SessionDefaultControl
}): CheckboxMenuItem {
  return {
    label,
    helpText,
    type: 'checkbox',
    checked,
    onClick: () => {
      onToggle()
    },
    endAdornment: (
      <DefaultForAllAdornment label={label} control={sessionDefault} />
    ),
  }
}

// A radio row in a promotable-value group (e.g. one option of a multi-value enum
// slot). `sessionDefault` is omitted for the base (inherit) value (e.g. the
// `up`/`normal` base of a mode enum) — only the non-base values are promotable.
export function promotableRadioItem({
  label,
  subLabel,
  helpText,
  checked,
  onClick,
  sessionDefault,
}: {
  label: string
  subLabel?: string
  helpText?: string
  checked: boolean
  onClick: () => void
  sessionDefault?: SessionDefaultControl
}): RadioMenuItem {
  return {
    label,
    subLabel,
    helpText,
    type: 'radio',
    checked,
    onClick,
    ...(sessionDefault && {
      endAdornment: (
        <DefaultForAllAdornment label={label} control={sessionDefault} />
      ),
    }),
  }
}
