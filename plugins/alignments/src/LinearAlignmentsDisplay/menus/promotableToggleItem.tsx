import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'

import type { CheckboxMenuItem } from '@jbrowse/core/ui'

// A promotable setting as one native checkbox menu row: the value toggles the
// track, and a trailing "default for all" adornment (endAdornment) promotes the
// current value as the session-wide default for this display type. Because it is
// an ordinary checkbox item, it inherits native hover/sizing/keyboard behavior —
// only the adornment is bespoke.
//
// `showDefault` defaults to `checked`: a promotable slot's default is always a
// real (on) value, and isDefault can only be true when the value is on, so
// gating the adornment on `checked` both hides the pointless "promote off" case
// and still surfaces it whenever it could be checked.
export function promotableToggleItem({
  label,
  checked,
  onToggle,
  isDefault,
  onToggleDefault,
  showDefault = checked,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  isDefault: boolean
  onToggleDefault: () => void
  showDefault?: boolean
}): CheckboxMenuItem {
  return {
    label,
    type: 'checkbox',
    checked,
    onClick: () => {
      onToggle()
    },
    endAdornment: showDefault ? (
      <DefaultForAllAdornment
        isDefault={isDefault}
        onToggleDefault={onToggleDefault}
      />
    ) : undefined,
  }
}
