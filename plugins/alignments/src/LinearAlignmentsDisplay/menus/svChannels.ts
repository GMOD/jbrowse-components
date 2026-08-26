import { toggleItem } from '@jbrowse/core/ui/menuItems'

import {
  SV_CHANNELS_LABEL,
  SV_CHANNELS_OFF,
  SV_CHANNELS_ON,
  isSvChannelsActive,
} from './svChannelsPreset.ts'

import type { ColorBy, GroupBy } from '../../shared/types.ts'
import type { ReadConnectionsMode } from '../constants.ts'
import type { SvChannelsSettings } from './svChannelsPreset.ts'

export interface SvChannelsModel extends SvChannelsSettings {
  setShowPileup: (show: boolean) => void
  setGroupBy: (groupBy?: GroupBy) => void
  setColorScheme: (colorBy: ColorBy) => void
  setReadConnections: (mode: ReadConnectionsMode) => void
  setReadConnectionsDown: (down: boolean) => void
  setDrawProperPairArcs: (draw: boolean) => void
}

export function applySvChannels(
  model: SvChannelsModel,
  settings: SvChannelsSettings,
) {
  model.setShowPileup(settings.showPileup)
  model.setGroupBy(settings.groupBy)
  model.setColorScheme(settings.colorBy)
  model.setReadConnections(settings.readConnections)
  model.setReadConnectionsDown(settings.readConnectionsDown)
  model.setDrawProperPairArcs(settings.drawProperPairArcs)
}

export function getSvChannelsMenuItem(model: SvChannelsModel) {
  return toggleItem(
    SV_CHANNELS_LABEL,
    isSvChannelsActive(model),
    on => {
      applySvChannels(model, on ? SV_CHANNELS_ON : SV_CHANNELS_OFF)
    },
    {
      helpText:
        'Split the reads into one band per pair orientation — LR normal, RL mates pointing outward, and the two same-strand classes — each band drawn as its own coverage with its own arcs, concordant pairs left out. The orientation classes are the read-pair evidence an SV caller works from: a deletion or an inversion junction puts a bundle of arcs in one band standing on its two breakpoints, and a band that stays empty across a call is a call with no read-pair support behind it. Turning this off restores an ordinary pileup.',
    },
  )
}
