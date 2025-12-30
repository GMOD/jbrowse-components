import type { MenuItem, MenuItemsGetter } from './MenuTypes'

export function useAsyncMenuItems(
  menuItems: MenuItemsGetter,
  isOpen: boolean,
): { items: MenuItem[]; loading: boolean; error: unknown } {
  if (!isOpen) {
    return { items: [], loading: false, error: null }
  }

  if (Array.isArray(menuItems)) {
    return { items: menuItems, loading: false, error: null }
  }

  // Call the function synchronously - async menu items are not currently used
  return { items: menuItems(), loading: false, error: null }
}
