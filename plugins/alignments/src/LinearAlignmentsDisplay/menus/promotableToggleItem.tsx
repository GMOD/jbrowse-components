import { PromotableToggleRow } from './PromotableToggleRow.tsx'

import type { CustomMenuItem } from '@jbrowse/core/ui'

// Factory for a `type:'custom'` menu row that pairs a setting's value with its
// "default for all tracks" toggle (see PromotableToggleRow). Kept separate from
// the component file so that file exports only the component (react-refresh).
//
// `showDefault` defaults to `checked`: a promotable slot's default is always a
// real (on) value, and isDefault can only be true when the value is on, so
// gating the default control on `checked` both hides the pointless "promote off"
// case and still surfaces it whenever it could be checked.
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
}): CustomMenuItem {
  return {
    type: 'custom',
    label,
    render: () => (
      <PromotableToggleRow
        label={label}
        checked={checked}
        onToggle={onToggle}
        isDefault={isDefault}
        onToggleDefault={onToggleDefault}
        showDefault={showDefault}
      />
    ),
  }
}
