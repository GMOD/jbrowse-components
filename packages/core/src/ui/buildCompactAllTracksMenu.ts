import type { MenuItem } from './MenuTypes.ts'

export type Compactness = 'normal' | 'compact' | 'super-compact'

export interface CompactableDisplay {
  setCompactness: (v: Compactness) => void
}

export function isCompactable(d: unknown): d is CompactableDisplay {
  return d !== null && typeof d === 'object' && 'setCompactness' in d
}

// Shared "Compact all tracks" submenu used by multiple view types (LGV,
// LinearComparativeView, BreakpointSplitView). Returns an empty array when
// no displays in the supplied tracks support `setCompactness` so callers can
// spread the result unconditionally.
export function buildCompactAllTracksMenu(
  tracks: { displays: unknown[] }[],
): MenuItem[] {
  const compactable = tracks.flatMap(t => t.displays.filter(isCompactable))
  if (compactable.length === 0) {
    return []
  }
  function applyCompactness(level: Compactness) {
    for (const display of compactable) {
      display.setCompactness(level)
    }
  }
  return [
    {
      label: 'Compact all tracks',
      subMenu: [
        {
          label: 'Normal',
          onClick: () => {
            applyCompactness('normal')
          },
        },
        {
          label: 'Compact',
          onClick: () => {
            applyCompactness('compact')
          },
        },
        {
          label: 'Super-compact',
          onClick: () => {
            applyCompactness('super-compact')
          },
        },
      ],
    },
  ]
}
