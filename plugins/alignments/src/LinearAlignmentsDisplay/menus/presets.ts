import { persistTrackConfigNow } from '@jbrowse/core/util'
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic'

import {
  PRESETS_LABEL,
  SV_CHANNELS_LABEL,
  SV_CHANNELS_SETTINGS,
} from './svChannelsPreset.ts'

import type { Plot } from '@jbrowse/core/configuration'
import type { FieldsPatch } from '@jbrowse/core/util/fieldPredicate'

export interface PresetsModel {
  applyPlot: (draft: Plot) => void
  setFilterFields: (patch: FieldsPatch) => void
}

// The filter goes in by field, so the reader's other filter fields stay; the
// plot draft would write the list whole
const { filter, ...SV_CHANNELS_PLOT } = SV_CHANNELS_SETTINGS

export function getPresetsMenuItem(model: PresetsModel) {
  return {
    label: PRESETS_LABEL,
    icon: AutoAwesomeMosaicIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: SV_CHANNELS_LABEL,
        onClick: () => {
          model.applyPlot(SV_CHANNELS_PLOT)
          model.setFilterFields({ svSignal: filter })
          persistTrackConfigNow(model)
        },
      },
    ],
  }
}
