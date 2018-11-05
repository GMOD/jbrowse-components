import mstModel from './appBarModel'
import ReactComponent from './AppBar'

export default class AppBarElement {
  install(browser) {
    this.installed = true
    browser.addUiType('appbar', { mstModel, ReactComponent })
  }
}
