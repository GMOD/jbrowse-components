import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { MenuItem } from '@jbrowse/core/ui/Menu'

// styles are used by FavoriteTracks and RecentlyUsedTracks

export const useSmallBadgeStyles = makeStyles()({
  // eslint-disable-next-line tss-unused-classes/unused-classes
  smallBadge: {
    height: 14,
  },
  // eslint-disable-next-line tss-unused-classes/unused-classes
  margin: {
    marginRight: 10,
  },
})

export const badgeAnchorOrigin = {
  vertical: 'bottom',
  horizontal: 'right',
} as const

export function getDropdownMenuItems({
  hasTracks,
  clearLabel,
  emptyLabel,
  onClear,
}: {
  hasTracks: boolean
  clearLabel: string
  emptyLabel: string
  onClear: () => void
}): MenuItem[] {
  return hasTracks
    ? [
        { type: 'divider' as const },
        {
          label: clearLabel,
          onClick: onClear,
        },
      ]
    : [
        {
          label: emptyLabel,
          onClick: () => {},
        },
      ]
}
