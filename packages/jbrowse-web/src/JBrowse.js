import React from 'react'
import ReactDOM from 'react-dom'
import * as mst from 'mobx-state-tree'
import { Provider } from 'mobx-react'

import App from './ui/App'
import RootModelFactory from './RootModelFactory'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

import AppBar from './ui/AppBar'

import LinearGenomeViewPlugin from './plugins/LinearGenomeView'

const uiComponents = [AppBar]

const corePlugins = [LinearGenomeViewPlugin]

// the main class used to configure and start a new JBrowse app
class JBrowse {
  uiTypes = {}

  viewTypes = {}

  uis = []

  plugins = []

  static lib = { 'mobx-state-tree': mst, React }

  constructor() {
    this.lib = JBrowse.lib

    // add ui components
    uiComponents.forEach(UiClass => {
      this.addUiComponent(new UiClass())
    })

    // add all the core plugins
    corePlugins.forEach(PluginClass => {
      this.addPlugin(new PluginClass())
    })

    this.getUiType = this.getUiType.bind(this)
    this.getViewType = this.getViewType.bind(this)
  }

  addPlugin(plugin) {
    if (this.configured)
      throw new Error('JBrowse already configured, cannot add plugins')
    plugin.install(this)
    this.plugins.push(plugin)
    return this
  }

  addViewType(name, { mstModel, ReactComponent }) {
    if (this.viewTypes[name])
      throw new Error(
        `a view type called "${name}" has already been added to this JBrowse instance`,
      )
    if (!mstModel)
      throw new Error(`no mobx-state-tree model provided for view type ${name}`)
    if (!ReactComponent)
      throw new Error(`no React component provided for view type ${name}`)
    this.viewTypes[name] = { mstModel, ReactComponent }
    return this
  }

  getViewType(name) {
    return this.viewTypes[name]
  }

  addUiComponent(uiComponent) {
    if (this.configured)
      throw new Error('JBrowse already configured, cannot add UI components')
    uiComponent.install(this)
    this.uis.push(uiComponent)
    return this
  }

  addUiType(name, { mstModel, ReactComponent }) {
    if (this.uiTypes[name])
      throw new Error(
        `a UI component called "${name}" has already been added to this JBrowse instance`,
      )
    if (!mstModel)
      throw new Error(
        `no mobx-state-tree model provided for UI component ${name}`,
      )
    if (!ReactComponent)
      throw new Error(`no React component provided for UI component ${name}`)
    this.uiTypes[name] = { mstModel, ReactComponent }
    return this
  }

  getUiType(name) {
    return this.uiTypes[name]
  }

  start() {
    const RootModel = RootModelFactory(this)
    this.model = RootModel.create({})
    this.model.addView('linear')
    this.model.views[0].addTrack('foo', 'Foo Track', 'tester')
    this.model.views[0].addTrack('bar', 'Bar Track', 'tester')
    this.model.views[0].addTrack('baz', 'Baz Track', 'tester')
    this.model.views[0].pushBlock('ctgA', 0, 100)
    this.model.addView('linear')
    this.model.views[1].addTrack('bee', 'Bee Track', 'tester')
    this.model.views[1].addTrack('bonk', 'Bonk Track', 'tester')
    this.model.views[1].tracks[0].configuration.backgroundColor.set('red')
    this.model.views[1].pushBlock('ctgA', 0, 100)

    this.model.addUi('appbar')
    this.model.uis[0].addMenu({
      name: 'FirstMenu',
      menuItems: [{ name: 'FirstMenuItem1' }],
    })
    this.model.uis[0].menus[0].addMenuItem({
      name: 'FirstMenuItem2',
      icon: 'bookmark',
    })
    this.model.uis[0].menus[0].addMenuItem({
      name: 'FirstMenuItem3',
      icon: 'search',
    })
    this.model.uis[0].addMenu({
      name: 'SecondMenu',
      menuItems: [{ name: 'SecondMenuItem1' }],
    })

    this.configured = true

    // console.log(JSON.stringify(getSnapshot(model)))

    // If you want your app to work offline and load faster, you can change
    // unregister() to register() below. Note this comes with some pitfalls.
    // Learn more about service workers: http://bit.ly/CRA-PWA
    serviceWorker.register()
    webWorkers.register()

    return this
  }

  render() {
    ReactDOM.render(
      <Provider rootModel={this.model}>
        <App getViewType={this.getViewType} getUiType={this.getUiType} />
      </Provider>,
      document.getElementById('root'),
    )
    return this
  }
}

export default JBrowse
