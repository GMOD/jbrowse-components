import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

const configSchema = ConfigurationSchema('BreakpointAlignmentsWidget', {})

const stateModel = types
  .model('BreakpointAlignmentsWidget', {
    featureData: types.frozen(),
    id: ElementId,
    type: types.literal('BreakpointAlignmentsWidget'),
  })
  .actions(self => ({
    clearFeatureData() {
      self.featureData = undefined
    },
    setFeatureData(data: unknown) {
      self.featureData = data
    },
  }))

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      ReactComponent: lazy(() => import('./BreakpointAlignmentsFeatureDetail')),
      configSchema,
      heading: 'Breakpoint feature details',
      name: 'BreakpointAlignmentsWidget',
      stateModel,
    })
  })
}
