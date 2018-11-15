import React from 'react'
import ReactDOM from 'react-dom'
import * as mst from 'mobx-state-tree'
import { Provider } from 'mobx-react'

import App from './ui/App'
import RootModelFactory from './RootModelFactory'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

import HierarchicalTrackSelectorDrawerWidgetPlugin from './plugins/HierarchicalTrackSelectorDrawerWidget'
import BamAdapterPlugin from './plugins/BamAdapter'
import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import LinearGenomeViewPlugin from './plugins/LinearGenomeView'

import { DrawerWidgetType, ViewType, TrackType, AdapterType } from './Plugin'

const corePlugins = [
  HierarchicalTrackSelectorDrawerWidgetPlugin,
  BamAdapterPlugin,
  LinearGenomeViewPlugin,
  AlignmentsTrackPlugin,
]

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
      if (this.phaseCallbacks[phaseName])
        this.phaseCallbacks[phaseName].forEach(callback => callback())
    })
  }
}

// the main class used to configure and start a new JBrowse app
class JBrowse {
  plugins = []

  elementTypes = {}

  elementCreationSchedule = new PhasedScheduler(
    'drawer widget',
    'adapter',
    'track',
    'view',
  )

  typeBaseClasses = {
    'drawer widget': DrawerWidgetType,
    track: TrackType,
    view: ViewType,
    adapter: AdapterType,
  }

  static lib = { 'mobx-state-tree': mst, React }

  constructor() {
    this.lib = JBrowse.lib

    this.getViewType = this.getElementType.bind(this, 'view')
    this.getTrackType = this.getElementType.bind(this, 'track')
    this.getAdapterType = this.getElementType.bind(this, 'adapter')
    this.getDrawerWidgetType = this.getElementType.bind(this, 'drawer widget')
    this.addTrackType = this.addElementType.bind(this, 'track')
    this.addViewType = this.addElementType.bind(this, 'view')
    this.addAdapterType = this.addElementType.bind(this, 'adapter')
    this.addDrawerWidgetType = this.addElementType.bind(this, 'drawer widget')

    // add all the core plugins
    corePlugins.forEach(PluginClass => {
      this.addPlugin(new PluginClass())
    })
  }

  addPlugin(plugin) {
    if (this.started)
      throw new Error('JBrowse already configured, cannot add plugins')
    if (this.plugins.includes(plugin))
      throw new Error(`plugin already installed`)
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
      if (this.elementTypes[groupName][element.name])
        throw new Error(
          `${groupName} ${
            element.name
          } already registered, cannot register it again`,
        )

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

  getElementTypeMembers(groupName, memberName) {
    return this.getElementTypesInGroup(groupName).map(t => t[memberName])
  }

  configure() {
    // run the creation callbacks for each element type in order.
    // currently tracks, then views
    this.elementCreationSchedule.run()
    delete this.elementCreationSchedule

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
      <Provider rootModel={this.model}>
        <App
          getViewType={this.getViewType}
          getDrawerWidgetType={this.getDrawerWidgetType}
        />
      </Provider>,
      document.getElementById('root'),
    )
    return this
  }
}

export default JBrowse
