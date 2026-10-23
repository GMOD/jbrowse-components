import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { facetForField } from '@jbrowse/display-kit/FacetWritesMixin'

import { READ_CONNECTIONS_MARK_TYPE } from '../constants.ts'
import {
  SV_CHANNELS_LABEL,
  SV_CHANNELS_OFF,
  SV_CHANNELS_ON,
  isSvChannelsActive,
} from './svChannelsPreset.ts'

import type { Facet } from '../../shared/types.ts'
import type { ReadConnectionsMark } from '../constants.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { WrittenFacet } from '@jbrowse/display-kit/FacetWritesMixin'

export interface SvChannelsModel {
  showPileup: boolean
  facet: Facet | undefined
  showReadConnections: boolean
  readConnectionsMark: ReadConnectionsMark
  showOrdinaryPairs: boolean
  writtenFacet: WrittenFacet
  applyPlot: (draft: Plot) => void
}

export function svChannelsActive(model: SvChannelsModel) {
  return isSvChannelsActive({
    pileup: { show: model.showPileup },
    facet: model.facet,
    readConnections: {
      show: model.showReadConnections,
      mark: READ_CONNECTIONS_MARK_TYPE[model.readConnectionsMark],
      ordinaryPairs: { show: model.showOrdinaryPairs },
    },
  })
}

export function getSvChannelsMenuItem(model: SvChannelsModel) {
  return toggleItem(SV_CHANNELS_LABEL, svChannelsActive(model), on => {
    // a regrouping on the field already grouping keeps its section order
    const { facet, ...bands } = on ? SV_CHANNELS_ON : SV_CHANNELS_OFF
    model.applyPlot({
      ...bands,
      facet: facet ? facetForField(model.writtenFacet, facet.field) : null,
    })
  })
}
