import { setConf } from '@jbrowse/core/configuration'
import { radioItems } from '@jbrowse/core/ui/menuItems'

import { DENSITY_TIER_MODES } from './densityTier.ts'

import type { DensityTierMode } from './densityTier.ts'
import type { DensityTierConfigModel } from './densityTierConfigSchemaFields.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RadioOption, SettingRowOptions } from '@jbrowse/core/ui/menuItems'

const LABELS: Record<DensityTierMode, string> = {
  auto: 'Automatic',
  features: 'Features only',
  density: 'Density only',
}

const DENSITY_TIER_OPTIONS: RadioOption<DensityTierMode>[] =
  DENSITY_TIER_MODES.map(value => ({ value, label: LABELS[value] }))

export interface DensityTierMenuHost {
  configuration: DensityTierConfigModel
  hasDensitySource: boolean
  densityTierMode: DensityTierMode
  regionTooLarge: boolean
  forceLoad: () => void
}

/**
 * The track menu's tri-state for the density band, written to the `densityTier`
 * slot. Only offered where the adapter has a density source, since without one
 * there is nothing the other two choices could show. Where the band stands in
 * for a refused fetch it also carries the banner's Force-load, since the band
 * has replaced the banner that button lived on.
 */
export function densityTierMenuItems(
  self: DensityTierMenuHost,
  opts?: SettingRowOptions,
): MenuItem[] {
  const forceLoad =
    self.densityTierMode === 'auto' && self.regionTooLarge
      ? [
          {
            label: 'Load features anyway (may be slow)',
            onClick: () => {
              self.forceLoad()
            },
          },
        ]
      : []
  return self.hasDensitySource
    ? [
        {
          label: 'Density band',
          ...opts,
          subMenu: [
            ...radioItems(DENSITY_TIER_OPTIONS, self.densityTierMode, mode => {
              setConf(self, 'densityTier', mode)
            }),
            ...forceLoad,
          ],
        },
      ]
    : []
}
