import type { MenuItem } from './Menu'
import type { PopupState } from './hooks'

export function sortByPriority<T extends { priority?: number }>(items: T[]) {
  return items.toSorted((a, b) => (b.priority || 0) - (a.priority || 0))
}

export function closeChildSubmenu(parentPopupState: PopupState | undefined) {
  if (parentPopupState?.childHandle) {
    parentPopupState.childHandle.close()
    parentPopupState.setChildHandle(undefined)
  }
}

export function checkMenuItemHasIcon(menuItems: MenuItem[]) {
  return menuItems.some(m => 'icon' in m && m.icon)
}

export function isSelectableMenuItem(
  item: MenuItem,
): item is MenuItem & { type: 'checkbox' | 'radio' } {
  return item.type === 'checkbox' || item.type === 'radio'
}

export function hasSelectableItemWithHelp(menuItems: MenuItem[]) {
  return menuItems.some(
    m =>
      (m.type === 'checkbox' || m.type === 'radio') &&
      'helpText' in m &&
      m.helpText,
  )
}
