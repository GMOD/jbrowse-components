import React from 'react'
import ReactDOM from 'react-dom'
import * as mst from 'mobx-state-tree'

import App from './ui/App'
import RootModelFactory from './RootModelFactory'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

import LinearGenomeViewPlugin from './plugins/LinearGenomeView'

const corePlugins = [LinearGenomeViewPlugin]

// the main class used to configure and start a new JBrowse app
class JBrowse {
  viewTypes = {}

  plugins = []

  static lib = { 'mobx-state-tree': mst, React }

  constructor() {
    this.lib = JBrowse.lib

    // add all the core plugins
    corePlugins.forEach(PluginClass => {
      this.addPlugin(new PluginClass())
    })

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
      <App getViewType={this.getViewType} rootModel={this.model} />,
      document.getElementById('root'),
    )
    return this
  }
}

export default JBrowse
