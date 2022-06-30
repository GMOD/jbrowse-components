import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'
import { types } from 'mobx-state-tree'
import ReactComponent from '../WiggleRendering'
import PluginManager from '@jbrowse/core/PluginManager'
import XYPlotRenderer from './XYPlotRenderer'

export { XYPlotRenderer, configSchema, ReactComponent }

const configSchema = ConfigurationSchema(
  'XYPlotRenderer',
  {
    filled: {
      type: 'boolean',
      defaultValue: true,
    },
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    },
  },
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new XYPlotRenderer({
        name: 'XYPlotRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
