import React from 'react'
import * as mst from 'mobx-state-tree'

import {
  DrawerWidgetType,
  RendererType,
  ViewType,
  TrackType,
  AdapterType,
} from './Plugin'
import { ConfigurationSchema } from './configuration'

// little helper class that keeps groups of callbacks that are
// then run in a specified order by group
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

export default class PluginManager {
  plugins = []

  elementTypes = {}

  elementCreationSchedule = new PhasedScheduler(
    'renderer',
    'adapter',
    'track',
    'view',
    'drawer widget',
  )

  typeBaseClasses = {
    'drawer widget': DrawerWidgetType,
    renderer: RendererType,
    track: TrackType,
    view: ViewType,
    adapter: AdapterType,
  }

  static lib = { 'mobx-state-tree': mst, React }

  constructor(initialPlugins = []) {
    this.lib = PluginManager.lib

    this.getViewType = this.getElementType.bind(this, 'view')
    this.getTrackType = this.getElementType.bind(this, 'track')
    this.getAdapterType = this.getElementType.bind(this, 'adapter')
    this.getDrawerWidgetType = this.getElementType.bind(this, 'drawer widget')
    this.getRendererType = this.getElementType.bind(this, 'renderer')
    this.addTrackType = this.addElementType.bind(this, 'track')
    this.addViewType = this.addElementType.bind(this, 'view')
    this.addAdapterType = this.addElementType.bind(this, 'adapter')
    this.addDrawerWidgetType = this.addElementType.bind(this, 'drawer widget')
    this.addRendererType = this.addElementType.bind(this, 'renderer')

    // add all the initial plugins
    initialPlugins.forEach(PluginClass => {
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

  /** get a MST type for the union of all specified pluggable MST types */
  pluggableMstType(
    typeGroup,
    fieldName,
    fallback = mst.types.maybe(mst.types.null),
  ) {
    const pluggableTypes = this.getElementTypeMembers(typeGroup, fieldName)
    // try to smooth over the case when no types are registered, mostly encountered in tests
    if (pluggableTypes.length === 0) return fallback
    return mst.types.union(...pluggableTypes)
  }

  /** get a MST type for the union of all specified pluggable config schemas */
  pluggableConfigSchemaType(
    typeGroup,
    fieldName = 'configSchema',
    fallback = ConfigurationSchema('Null', {}),
  ) {
    return this.pluggableMstType(typeGroup, fieldName, fallback)
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
    if (!typeName) throw new Error(`invalid type name "${typeName}"`)
    return (this.elementTypes[groupName] || {})[typeName]
  }

  getElementTypesInGroup(groupName) {
    return Object.values(this.elementTypes[groupName] || {})
  }

  getElementTypeMembers(groupName, memberName) {
    return this.getElementTypesInGroup(groupName)
      .map(t => t[memberName])
      .filter(m => !!m)
  }

  configure() {
    if (this.configured) throw new Error('already configured')

    // run the creation callbacks for each element type in order.
    // see elementCreationSchedule above for the creation order
    this.elementCreationSchedule.run()
    delete this.elementCreationSchedule

    this.plugins.forEach(plugin => plugin.configure())

    this.configured = true

    // console.log(JSON.stringify(getSnapshot(model)))

    return this
  }
}
