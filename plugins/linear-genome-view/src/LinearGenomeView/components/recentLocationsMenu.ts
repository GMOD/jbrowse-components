import type { MenuItem } from '@jbrowse/core/ui'

// Builds the "Recent ▸" submenu shared by the header search box and the import
// form overflow menus, so both surfaces stay identical. Empty when there is no
// history yet, so the ⋮ button only appears once there is something to show.
export function recentLocationsMenu({
  recentLocations,
  onNavigate,
  onClear,
}: {
  recentLocations: string[]
  onNavigate: (loc: string) => void
  onClear: () => void
}): MenuItem[] {
  return recentLocations.length
    ? [
        {
          label: 'Recent',
          subMenu: [
            ...recentLocations.map(loc => ({
              label: loc,
              onClick: () => {
                onNavigate(loc)
              },
            })),
            { type: 'divider' as const },
            { label: 'Clear recent locations', onClick: onClear },
          ],
        },
      ]
    : []
}
