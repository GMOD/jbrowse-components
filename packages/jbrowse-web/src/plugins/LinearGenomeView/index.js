import mstModel from './models/model'
import ReactComponent from './components/LinearGenomeView'

import Plugin, { View } from '../../Plugin'

export default class LinearGenomeViewPlugin extends Plugin {
  install(browser) {
    this.browser = browser
    this.installed = true
    browser.addViewType(
      new View({ name: 'linear', stateModel: mstModel, ReactComponent }),
    )
  }
}
