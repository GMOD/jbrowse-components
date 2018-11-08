import React from 'react'
import ReactDOM from 'react-dom'
import * as mst from 'mobx-state-tree'

import App from './ui/App'
import RootModelFactory from './RootModelFactory'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import LinearGenomeViewPlugin from './plugins/LinearGenomeView'

import { View, Track } from './Plugin'

const corePlugins = [LinearGenomeViewPlugin, AlignmentsTrackPlugin]

// the main class used to configure and start a new JBrowse app
class JBrowse {
  viewTypes = {}

  trackTypes = {}

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
    if (this.started)
      throw new Error('JBrowse already configured, cannot add plugins')
    plugin.install(this)
    this.plugins.push(plugin)
    return this
  }

  addViewType(element) {
    if (!(element instanceof View)) throw new Error('element must be a View')
    return this.addElementType(element)
  }

  addTrackType(element) {
    if (!(element instanceof Track)) throw new Error('element must be a Track')
    return this.addElementType(element)
  }

  addElementType(element) {
    if (element instanceof Track) {
      if (this.trackTypes[element.name])
        throw new Error(`track type ${element.name} already exists`)
      this.trackTypes[element.name] = element
    } else if (element instanceof View) {
      if (this.viewTypes[element.name])
        throw new Error(`view type ${element.name} already exists`)
      this.viewTypes[element.name] = element
    } else {
      throw new Error(`unknown pluggable element type, cannot add`)
    }
    return this
  }

  getViewType(name) {
    return this.viewTypes[name]
  }

  configure() {
    const RootModel = RootModelFactory(this)
    this.model = RootModel.create({})

    this.plugins.forEach(plugin => plugin.configure())

    this.configured = true

    // console.log(JSON.stringify(getSnapshot(model)))

    return this
  }

  start() {
    // If you want your app to work offline and load faster, you can change
    // unregister() to register() below. Note this comes with some pitfalls.
    // Learn more about service workers: http://bit.ly/CRA-PWA
    serviceWorker.register()
    webWorkers.register()

    ReactDOM.render(
      <App getViewType={this.getViewType} rootModel={this.model} />,
      document.getElementById('root'),
    )
    return this
  }
}

export default JBrowse
