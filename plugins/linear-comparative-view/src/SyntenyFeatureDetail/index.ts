import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
import { stateModelFactory as BaseFeatureWidgetStateModelF } from '@jbrowse/core/BaseFeatureWidget'

const configSchema = ConfigurationSchema('SyntenyFeatureWidget', {})

function stateModelF(pluginManager: PluginManager) {
  return types.compose(
    BaseFeatureWidgetStateModelF(pluginManager),
    types.model('SyntenyFeatureWidget', {
      /**
       * #property
       */
      type: types.literal('SyntenyFeatureWidget'),
      /**
       * #property
       */
      level: types.maybe(types.number),
    }),
  )
}

export default function SyntenyFeatureWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'SyntenyFeatureWidget',
        heading: 'Synteny feature details',
        configSchema,
        stateModel: stateModelF(pluginManager),
        ReactComponent: lazy(() => import('./SyntenyFeatureDetail')),
      }),
  )
}
