import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'

import type { SessionDefaultControl } from './sessionDefaultControl.ts'
import type { CheckboxMenuItem } from '@jbrowse/core/ui'

// A promotable setting as one native checkbox menu row: the value toggles the
// track (inheriting native hover/sizing/keyboard), and a trailing pin
// (endAdornment) promotes the setting's on-value as the session-wide default for
// this display type. The pin is always shown so the capability is discoverable.
export function promotableToggleItem({
  label,
  checked,
  onToggle,
  sessionDefault,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  sessionDefault: SessionDefaultControl
}): CheckboxMenuItem {
  return {
    label,
    type: 'checkbox',
    checked,
    onClick: () => {
      onToggle()
    },
    endAdornment: (
      <DefaultForAllAdornment
        isDefault={sessionDefault.active}
        onToggleDefault={() => {
          sessionDefault.toggle()
        }}
      />
    ),
  }
}
