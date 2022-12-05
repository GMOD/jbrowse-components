import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

const configSchema = ConfigurationSchema('BreakpointAlignmentsWidget', {})

const stateModel = types
  .model('BreakpointAlignmentsWidget', {
    id: ElementId,
    type: types.literal('BreakpointAlignmentsWidget'),
    featureData: types.frozen(),
  })
  .actions(self => ({
    setFeatureData(data: unknown) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = undefined
    },
  }))

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'BreakpointAlignmentsWidget',
      heading: 'Breakpoint feature details',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./BreakpointAlignmentsFeatureDetail')),
    })
  })
}
