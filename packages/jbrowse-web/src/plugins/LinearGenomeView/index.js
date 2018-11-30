import modelFactory from './models/model'
import ReactComponent from './components/LinearGenomeView'

import Plugin, { ViewType } from '../../Plugin'

export default class LinearGenomeViewPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addViewType(() => {
      this.installed = true

      return new ViewType({
        name: 'LinearGenomeView',
        stateModel: modelFactory(pluginManager),
        ReactComponent,
      })
    })
  }
}
