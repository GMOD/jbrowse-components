import PluginManager from '@gmod/jbrowse-core/PluginManager'
import stateModel from './model'
import GDCFilterComponentF from './components/GDCFilterComponent'

export default (jbrowse: PluginManager) => {
  const React = jbrowse.lib.react

  const ReactComponent = jbrowse.load(GDCFilterComponentF)
  const { ConfigurationSchema } = jbrowse.lib[
    '@gmod/jbrowse-core/configuration'
  ]

  const { observer } = jbrowse.lib['mobx-react']

  return {
    configSchema: ConfigurationSchema('GDCFilterDrawerWidget', {}),
    ReactComponent,
    stateModel: jbrowse.load(stateModel),
    HeadingComponent: observer(() => {
      return <>GDC Filters</>
    }),
  }
}
