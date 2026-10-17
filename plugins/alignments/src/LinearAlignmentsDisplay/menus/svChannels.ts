import { toggleItem } from '@jbrowse/core/ui/menuItems'

import {
  SV_CHANNELS_LABEL,
  SV_CHANNELS_OFF,
  SV_CHANNELS_ON,
  isSvChannelsActive,
} from './svChannelsPreset.ts'

import type { Facet } from '../../shared/types.ts'
import type { ReadConnectionsMark } from '../constants.ts'

export interface SvChannelsModel {
  showPileup: boolean
  facet: Facet | undefined
  showReadConnections: boolean
  readConnectionsMark: ReadConnectionsMark
  showOrdinaryPairs: boolean
  setFacet: (facet?: Facet) => void
  applyDisplaySettings: (settings: Record<string, unknown>) => unknown
}

export function svChannelsActive(model: SvChannelsModel) {
  return isSvChannelsActive({
    pileup: { show: model.showPileup },
    facet: model.facet,
    readConnections: {
      show: model.showReadConnections,
      mark: model.readConnectionsMark,
      showOrdinaryPairs: model.showOrdinaryPairs,
    },
  })
}

export function getSvChannelsMenuItem(model: SvChannelsModel) {
  return toggleItem(
    SV_CHANNELS_LABEL,
    svChannelsActive(model),
    on => {
      // the facet through its own setter, which also resets the scroll and
      // carries a section order across a regrouping on the same field
      const { facet, ...bands } = on ? SV_CHANNELS_ON : SV_CHANNELS_OFF
      model.setFacet(facet ? { ...facet } : undefined)
      model.applyDisplaySettings(bands)
    },
    {
      helpText:
        'Split the reads into one band per pair orientation — LR normal, RL mates pointing outward, and the two same-strand classes — each band drawn as its own coverage with its own arcs, concordant pairs left out. The orientation classes are the read-pair evidence an SV caller works from: a deletion or an inversion junction puts a bundle of arcs in one band standing on its two breakpoints, and a band that stays empty across a call is a call with no read-pair support behind it. Turning this off restores an ordinary pileup.',
    },
  )
}
