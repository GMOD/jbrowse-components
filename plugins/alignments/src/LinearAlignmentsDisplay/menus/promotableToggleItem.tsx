import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'

import type { SessionDefaultControl } from './sessionDefaultControl.ts'
import type { CheckboxMenuItem, RadioMenuItem } from '@jbrowse/core/ui'

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

// A radio row in a promotable-value group (e.g. one option of a multi-value
// enum slot). `sessionDefault` is omitted for the base/un-pinned value (e.g.
// 'up' in sashimiArcsMode) — only the non-base values are pinnable, mirroring
// the arcs/read-cloud pins sharing the readConnections slot.
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
        <DefaultForAllAdornment
          isDefault={sessionDefault.active}
          onToggleDefault={() => {
            sessionDefault.toggle()
          }}
        />
      ),
    }),
  }
}
