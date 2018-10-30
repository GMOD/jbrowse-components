import mstModel from './model'
import ReactComponent from './LinearGenomeView'

export default class LinearGenomeViewPlugin {
  install(browser) {
    this.installed = true
    browser.addViewType('linear', { mstModel, ReactComponent })
  }
}
