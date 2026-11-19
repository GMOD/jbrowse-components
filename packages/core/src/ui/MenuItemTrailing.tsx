import ChevronRight from '@mui/icons-material/ChevronRight'
import { observer } from 'mobx-react'

import { MenuItemEndDecoration } from './MenuItemEndDecoration.tsx'
import { menuItemAdornment } from './menuItemAdornment.ts'

import type { ClickableMenuItem, SubMenuItem } from './MenuTypes.ts'

// gap that sets the value glyph (row state) apart from the adornment column, so
// a busy row reads as "value | pin" not one dense cluster
const valueAdornmentGap = 8

// fixed footprint reserved for the endAdornment column so pins right-align
const endAdornmentColumnWidth = 28

// The two row kinds that draw a trailing stack, in one component so a column
// added to one cannot be forgotten on the other.
export type DecoratedMenuItem = ClickableMenuItem | SubMenuItem

const MenuItemValueGlyph = observer(function MenuItemValueGlyph({
  type,
  checked,
  separated,
}: {
  type: 'checkbox' | 'radio'
  checked: boolean
  separated: boolean
}) {
  return (
    <div style={{ marginRight: separated ? valueAdornmentGap : 0 }}>
      <MenuItemEndDecoration type={type} checked={checked} />
    </div>
  )
})

// Reserved on every row of a menu that has any adornment (e.g. the "default for
// all" pin), so the adornments right-align into their own column.
const MenuItemEndAdornmentSlot = observer(function MenuItemEndAdornmentSlot({
  children,
}: {
  children: React.ReactNode
}) {
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
})

// Everything trailing a row's label: a flex spacer that right-aligns the rest,
// the value glyph, the menu-wide adornment column, and a submenu row's chevron.
export const MenuItemTrailing = observer(function MenuItemTrailing({
  item,
  adornmentColumn,
}: {
  item: DecoratedMenuItem
  adornmentColumn: boolean
}) {
  return (
    <>
      <div style={{ flexGrow: 1, minWidth: 10 }} />
      {item.type === 'checkbox' || item.type === 'radio' ? (
        <MenuItemValueGlyph
          type={item.type}
          checked={item.checked}
          separated={adornmentColumn}
        />
      ) : null}
      {adornmentColumn ? (
        <MenuItemEndAdornmentSlot>
          {menuItemAdornment(item)}
        </MenuItemEndAdornmentSlot>
      ) : null}
      {'subMenu' in item ? <ChevronRight /> : null}
    </>
  )
})
