import CascadingMenuHelpIconButton, {
  CascadingMenuHelpIconSpacer,
} from './CascadingMenuHelpIconButton.tsx'
import { MenuItemEndDecoration } from './MenuItemEndDecoration.tsx'
import { menuItemAdornment } from './menuItemAdornment.tsx'

import type { ClickableMenuItem } from './MenuTypes.ts'

// gap that sets the value glyph (row state) apart from the trailing help/pin
// action column, so a busy row reads as "value | actions" not one dense cluster
const valueActionGap = 8

// fixed footprint reserved for the endAdornment column so pins right-align
const endAdornmentColumnWidth = 28

// The checkbox/radio glyph reflecting a row's value. Held slightly apart from
// the action column when the menu has one, so state and actions don't blur.
function MenuItemValueGlyph({
  type,
  checked,
  separated,
}: {
  type: 'checkbox' | 'radio'
  checked: boolean
  separated: boolean
}) {
  return (
    <div style={{ marginRight: separated ? valueActionGap : 0 }}>
      <MenuItemEndDecoration type={type} checked={checked} />
    </div>
  )
}

// Rightmost fixed-width column holding an item's endAdornment (e.g. the "default
// for all" pin). Reserved on every row of a menu that has any adornment so they
// right-align into their own column.
function MenuItemEndAdornmentSlot({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: endAdornmentColumnWidth,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  )
}

// Everything trailing a menu row's label: a flex spacer that right-aligns the
// decorations, then the value glyph, help affordance, and endAdornment column.
// The flags are menu-wide (true if ANY row needs the column) so every row
// reserves matching slots and the decorations stack into aligned columns. When
// `sharedActionColumn` is set, no row combines help with an adornment, so the two
// share one trailing column (whichever this row has) rather than each claiming
// its own.
export function MenuItemTrailing({
  item,
  hasCheckboxOrRadioWithHelp,
  hasEndAdornment,
  sharedActionColumn,
}: {
  item: ClickableMenuItem
  hasCheckboxOrRadioWithHelp: boolean
  hasEndAdornment: boolean
  sharedActionColumn: boolean
}) {
  const isCheckOrRadio = item.type === 'checkbox' || item.type === 'radio'
  const hasActionColumn = hasCheckboxOrRadioWithHelp || hasEndAdornment
  // a disabled row can't open the help popover (pointer-events:none), so its
  // helpText is surfaced as a hover tooltip by the row instead
  const helpButton =
    item.helpText && !item.disabled ? (
      <CascadingMenuHelpIconButton
        helpText={item.helpText}
        label={item.label}
      />
    ) : undefined
  return (
    <>
      <div style={{ flexGrow: 1, minWidth: 10 }} />
      {isCheckOrRadio ? (
        <MenuItemValueGlyph
          type={item.type}
          checked={item.checked}
          separated={hasActionColumn}
        />
      ) : null}
      {sharedActionColumn ? (
        <MenuItemEndAdornmentSlot>
          {helpButton ?? menuItemAdornment(item)}
        </MenuItemEndAdornmentSlot>
      ) : (
        <>
          {/* on a checkbox/radio row lacking help that shares a menu with rows
              that have it, an invisible spacer of the same footprint keeps the
              value glyphs column-aligned */}
          {helpButton ??
            (isCheckOrRadio && hasCheckboxOrRadioWithHelp ? (
              <CascadingMenuHelpIconSpacer />
            ) : null)}
          {hasEndAdornment ? (
            <MenuItemEndAdornmentSlot>
              {menuItemAdornment(item)}
            </MenuItemEndAdornmentSlot>
          ) : null}
        </>
      )}
    </>
  )
}
