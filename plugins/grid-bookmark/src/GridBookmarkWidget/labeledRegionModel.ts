import { types } from 'mobx-state-tree'
import { Region as RegionModel } from '@jbrowse/core/util/types/mst'

export const LabeledRegionModel = types
  .compose(
    'LabeledRegionModel',
    RegionModel,
    types.model('Label', {
      label: types.optional(types.string, ''),
      highlight: types.optional(types.string, 'rgba(247, 129, 192, 0.35)'),
    }),
  )
  .actions(self => ({
    setLabel(label: string) {
      self.label = label
    },
    setHighlight(color: string) {
      self.highlight = color
    },
  }))
