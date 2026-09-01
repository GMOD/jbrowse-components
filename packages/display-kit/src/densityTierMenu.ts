import { setConf } from '@jbrowse/core/configuration'

import { DENSITY_TIER_MODES } from './densityTier.ts'

import type { DensityTierMode } from './densityTier.ts'
import type { DensityTierConfigModel } from './densityTierConfigSchemaFields.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const LABELS: Record<DensityTierMode, string> = {
  auto: 'Automatic',
  features: 'Features only',
  density: 'Density only',
}

/**
 * The track menu's tri-state for the density tier, written to the `densityTier`
 * slot. Only offered where the adapter has a density source, since without one
 * there is nothing the other two choices could show.
 */
export function densityTierMenuItems(self: {
  configuration: DensityTierConfigModel
  hasDensitySource: boolean
  densityTierMode: DensityTierMode
}): MenuItem[] {
  return self.hasDensitySource
    ? [
        {
          label: 'Density tier',
          subMenu: DENSITY_TIER_MODES.map(mode => ({
            label: LABELS[mode],
            type: 'radio' as const,
            checked: self.densityTierMode === mode,
            onClick: () => {
              setConf(self, 'densityTier', mode)
            },
          })),
        },
      ]
    : []
}
