import React from 'react'
import ReactDOM from 'react-dom'
import * as mst from 'mobx-state-tree'

import App from './ui/App'
import RootModelFactory from './RootModelFactory'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import LinearGenomeViewPlugin from './plugins/LinearGenomeView'

import { ViewType, TrackType } from './Plugin'

const corePlugins = [LinearGenomeViewPlugin, AlignmentsTrackPlugin]

// keeps groups of callbacks that are then run in a specified order by group
class PhasedScheduler {
  phaseCallbacks = {}

  constructor(...phaseOrder) {
    this.phaseOrder = phaseOrder
  }

  add(phase, callback) {
    if (!this.phaseOrder.includes(phase))
      throw new Error(`unknown phase ${phase}`)
    if (!this.phaseCallbacks[phase]) this.phaseCallbacks[phase] = []
    this.phaseCallbacks[phase].push(callback)
  }

  run() {
    this.phaseOrder.forEach(phaseName => {
      this.phaseCallbacks[phaseName].forEach(callback => callback())
    })
  }
}

// the main class used to configure and start a new JBrowse app
class JBrowse {
  plugins = []

  elementTypes = {}

  elementCreationSchedule = new PhasedScheduler('track', 'view')

  typeBaseClasses = { track: TrackType, view: ViewType }

  static lib = { 'mobx-state-tree': mst, React }

  constructor() {
    this.lib = JBrowse.lib

    this.getViewType = this.getElementType.bind(this, 'view')
    this.getTrackType = this.getElementType.bind(this, 'track')
    this.addTrackType = this.addElementType.bind(this, 'track')
    this.addViewType = this.addElementType.bind(this, 'view')

    // add all the core plugins
    corePlugins.forEach(PluginClass => {
      this.addPlugin(new PluginClass())
    })
  }

  addPlugin(plugin) {
    if (this.started)
      throw new Error('JBrowse already configured, cannot add plugins')
    plugin.install(this)
    this.plugins.push(plugin)
    return this
  }

  addElementType(groupName, creationCallback) {
    if (typeof creationCallback !== 'function')
      throw new Error('must provide a callback function')
    const typeBaseClass = this.typeBaseClasses[groupName]
    if (!typeBaseClass)
      throw new Error(`unknown pluggable element type ${groupName}, cannot add`)
    if (!this.elementTypes[groupName]) this.elementTypes[groupName] = {}

    this.elementCreationSchedule.add(groupName, () => {
      const element = creationCallback(this)
      this.elementTypes[groupName][element.name] = element
    })

    return this
  }

  getElementType(groupName, typeName) {
    return (this.elementTypes[groupName] || {})[typeName]
  }

  getElementTypesInGroup(groupName) {
    return Object.values(this.elementTypes[groupName] || {})
  }

  configure() {
    // run the creation callbacks for each element type in order.
    // currently tracks, then views
    this.elementCreationSchedule.run()

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
