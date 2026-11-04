import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic'

import { SV_CHANNELS_LABEL, SV_CHANNELS_SETTINGS } from './svChannelsPreset.ts'

import type { Plot } from '@jbrowse/core/configuration'

export interface PresetsModel {
  applyPlot: (draft: Plot) => void
}

export const PRESETS_LABEL = 'Presets'

// A preset is an action, not a toggle: it writes its settings and the menus
// owning each one show the result, so there is no checked state to keep in
// step and no "off" to define.
export function getPresetsMenuItem(model: PresetsModel) {
  return {
    label: PRESETS_LABEL,
    icon: AutoAwesomeMosaicIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: SV_CHANNELS_LABEL,
        onClick: () => {
          model.applyPlot(SV_CHANNELS_SETTINGS)
        },
      },
    ],
  }
}
