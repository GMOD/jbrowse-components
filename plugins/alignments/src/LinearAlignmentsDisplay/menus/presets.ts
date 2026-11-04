import { persistTrackConfigNow } from '@jbrowse/core/util'
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic'

import {
  PRESETS_LABEL,
  SV_CHANNELS_LABEL,
  SV_CHANNELS_SETTINGS,
} from './svChannelsPreset.ts'

import type { Plot } from '@jbrowse/core/configuration'

export interface PresetsModel {
  applyPlot: (draft: Plot) => void
}

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
          persistTrackConfigNow(model)
        },
      },
    ],
  }
}
