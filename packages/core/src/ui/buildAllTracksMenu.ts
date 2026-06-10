import type { MenuItem } from './MenuTypes.ts'
import type PluginManager from '../PluginManager.ts'

export type Compactness = 'normal' | 'compact' | 'super-compact'

export interface CompactableDisplay {
  setCompactness: (v: Compactness) => void
}

export function isCompactable(d: unknown): d is CompactableDisplay {
  return d !== null && typeof d === 'object' && 'setCompactness' in d
}

// A group operation contributes a single entry to the "All tracks" submenu. It
// receives every display in the view and returns its menu items, or `[]` when
// no display supports the operation (so callers can spread unconditionally).
// Each op should fan out an idempotent setter — not a per-track toggle — so all
// tracks land in the same state.
export type GroupOp = (displays: unknown[]) => MenuItem[]

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-extendAllTracksMenu': {
      args: GroupOp[]
      result: GroupOp[]
    }
  }
}

const compactnessGroupOp: GroupOp = displays => {
  const compactable = displays.filter(isCompactable)
  function applyCompactness(level: Compactness) {
    for (const display of compactable) {
      display.setCompactness(level)
    }
  }
  return compactable.length === 0
    ? []
    : [
        {
          label: 'Compactness',
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

// Shared "All tracks" group-operations submenu used by multiple view types
// (LGV, LinearComparativeView, BreakpointSplitView). Core ships the
// cross-display compactness op; plugins contribute display-specific ops (e.g.
// alignments arc mode) via the `Core-extendAllTracksMenu` extension point.
// Returns an empty array when no op applies so callers can spread the result.
export function buildAllTracksMenu(
  pluginManager: PluginManager,
  tracks: { displays: unknown[] }[],
): MenuItem[] {
  const displays = tracks.flatMap(t => t.displays)
  const ops = pluginManager.evaluateExtensionPoint('Core-extendAllTracksMenu', [
    compactnessGroupOp,
  ])
  const subMenu = ops.flatMap(op => op(displays))
  return subMenu.length === 0 ? [] : [{ label: 'All tracks', subMenu }]
}
