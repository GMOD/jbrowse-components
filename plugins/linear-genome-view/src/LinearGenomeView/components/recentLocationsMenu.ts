import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

import type { MenuItem, RecentLocation } from '@jbrowse/core/ui'

/**
 * What a navigated result is worth remembering as. The display string is what
 * the row shows; the location is what reopening it opens, and is absent for a
 * freehand query, whose label is the searchable thing. Paired with the
 * `BaseResult` the menu rebuilds below so the round trip stays visible in one
 * place: a row replayed through it records the same pair it came from.
 */
export function recentLocationOf(option: BaseResult): RecentLocation {
  return { label: option.getDisplayString(), loc: option.getLocation() }
}

// Builds the "Recent ▸" submenu shared by the header search box and the import
// form overflow menus, so both surfaces stay identical. Empty when there is no
// history yet, so the ⋮ button only appears once there is something to show.
export function recentLocationsMenu({
  recentLocations,
  onNavigate,
  onClear,
}: {
  recentLocations: RecentLocation[]
  onNavigate: (option: BaseResult) => void
  onClear: () => void
}): MenuItem[] {
  return recentLocations.length
    ? [
        {
          label: 'Recent',
          subMenu: [
            ...recentLocations.map(({ label, loc }) => ({
              label,
              onClick: () => {
                // a row that recorded a location navigates straight to it; one
                // with only a label goes back through the search path, which is
                // where a freehand query resolved the first time
                onNavigate(new BaseResult({ label, locString: loc }))
              },
            })),
            { type: 'divider' as const },
            { label: 'Clear recent locations', onClick: onClear },
          ],
        },
      ]
    : []
}
