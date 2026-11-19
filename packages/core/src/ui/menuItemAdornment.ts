import type { MenuItem } from './MenuTypes.ts'

export function menuItemAdornment(item: MenuItem) {
  return 'endAdornment' in item ? item.endAdornment : undefined
}

// a custom row draws edge to edge and never reaches the trailing column
export function hasMenuItemAdornment(item: MenuItem) {
  return item.type !== 'custom' && !!menuItemAdornment(item)
}
