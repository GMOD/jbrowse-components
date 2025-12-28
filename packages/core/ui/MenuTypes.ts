import type { SvgIconProps } from '@mui/material'

export interface MenuDivider {
  priority?: number
  type: 'divider'
}

export interface MenuSubHeader {
  type: 'subHeader'
  priority?: number
  label: string
}

export interface BaseMenuItem {
  id?: string
  label: React.ReactNode
  priority?: number
  subLabel?: string
  icon?: React.ComponentType<SvgIconProps>
  disabled?: boolean
  helpText?: string
  /** Single character keyboard shortcut for quick selection */
  shortcut?: string
}

export interface NormalMenuItem extends BaseMenuItem {
  type?: 'normal'
  onClick: (...args: any[]) => void
}

export interface CheckboxMenuItem extends BaseMenuItem {
  type: 'checkbox'
  checked: boolean
  onClick: (...args: any[]) => void
}

export interface RadioMenuItem extends BaseMenuItem {
  type: 'radio'
  checked: boolean
  onClick: (...args: any[]) => void
}

export interface SubMenuItem extends BaseMenuItem {
  type?: 'subMenu'
  subMenu: MenuItem[]
}

export type MenuItem =
  | MenuDivider
  | MenuSubHeader
  | NormalMenuItem
  | CheckboxMenuItem
  | RadioMenuItem
  | SubMenuItem

export type MenuItemsGetter =
  | MenuItem[]
  | (() => MenuItem[])
  | (() => Promise<MenuItem[]>)
