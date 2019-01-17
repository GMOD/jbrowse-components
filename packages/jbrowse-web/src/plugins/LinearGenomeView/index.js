import modelFactory from './models'
import ReactComponent from './components/LinearGenomeView'

import Plugin from '../../Plugin'
import ViewType from '../../pluggableElementTypes/ViewType'

import configSchema from './models/configSchema'

export default class LinearGenomeViewPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addViewType(() => {
      this.installed = true

      return new ViewType({
        name: 'LinearGenomeView',
        stateModel: modelFactory(pluginManager),
        configSchema,
        ReactComponent,
      })
    })
  }
}
