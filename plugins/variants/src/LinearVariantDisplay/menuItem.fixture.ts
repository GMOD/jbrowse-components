import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import type { MenuItem } from '@jbrowse/core/ui'

export function findItem(
  items: MenuItem[],
  label: string,
): MenuItem | undefined {
  for (const item of items) {
    if ('label' in item && item.label === label) {
      return item
    }
    const found =
      'subMenu' in item ? findItem(resolveSubMenu(item), label) : undefined
    if (found) {
      return found
    }
  }
  return undefined
}
