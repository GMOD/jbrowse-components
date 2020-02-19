import { types } from 'mobx-state-tree'

import { Renderer } from 'react-dom'
import { type } from 'os'
import { element } from 'prop-types'
import PluggableElementBase from './pluggableElementTypes/PluggableElementBase'
import RendererType from './pluggableElementTypes/renderers/RendererType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import ViewType from './pluggableElementTypes/ViewType'
import DrawerWidgetType from './pluggableElementTypes/DrawerWidgetType'
import MenuBarType from './pluggableElementTypes/MenuBarType'
import ConnectionType from './pluggableElementTypes/ConnectionType'

import { ConfigurationSchema } from './configuration'

import Plugin from './Plugin'
import ReExports from './ReExports'

import {
  PluggableElementType,
  PluggableElementMember,
} from './pluggableElementTypes'

/** little helper class that keeps groups of callbacks that are
then run in a specified order by group */
class PhasedScheduler<PhaseName extends string> {
  phaseCallbacks = new Map<PhaseName, Function[]>()

  phaseOrder: PhaseName[] = []

  constructor(...phaseOrder: PhaseName[]) {
    this.phaseOrder = phaseOrder
  }

  add(phase: PhaseName, callback: Function) {
    if (!this.phaseOrder.includes(phase)) {
      throw new Error(`unknown phase ${phase}`)
    }
    let phaseCallbacks = this.phaseCallbacks.get(phase)
    if (!phaseCallbacks) {
      phaseCallbacks = []
      this.phaseCallbacks.set(phase, phaseCallbacks)
    }
    phaseCallbacks.push(callback)
  }

  run() {
    this.phaseOrder.forEach(phaseName => {
      const phaseCallbacks = this.phaseCallbacks.get(phaseName)
      if (phaseCallbacks) {
        phaseCallbacks.forEach(callback => callback())
      }
    })
  }
}

type PluggableElementTypeGroup =
  | 'renderer'
  | 'adapter'
  | 'track'
  | 'connection'
  | 'view'
  | 'drawer widget'
  | 'menu bar'

/** internal class that holds the info for a certain element type */
class TypeRecord<ElementClass extends PluggableElementBase> {
  registeredTypes: { [name: string]: ElementClass } = {}

  baseClass: { new (...args: any[]): ElementClass }

  constructor(elementType: { new (...args: any[]): ElementClass }) {
    this.baseClass = elementType
  }

  add(name: string, t: ElementClass) {
    this.registeredTypes[name] = t
  }

  has(name: string) {
    return name in this.registeredTypes
  }

  get(name: string) {
    return this.registeredTypes[name]
  }

  all() {
    return Object.values(this.registeredTypes)
  }
}

export default class PluginManager {
  plugins: Plugin[] = []

  elementCreationSchedule = new PhasedScheduler<PluggableElementTypeGroup>(
    'renderer',
    'adapter',
    'track',
    'connection',
    'view',
    'drawer widget',
    'menu bar',
  )

  rendererTypes = new TypeRecord(RendererType)

  adapterTypes = new TypeRecord(AdapterType)

  trackTypes = new TypeRecord(TrackType)

  connectionTypes = new TypeRecord(ConnectionType)

  viewTypes = new TypeRecord(ViewType)

  drawerWidgetTypes = new TypeRecord(DrawerWidgetType)

  menuBarTypes = new TypeRecord(MenuBarType)

  configured = false

  constructor(initialPlugins = []) {
    // add all the initial plugins
    initialPlugins.forEach(plugin => {
      this.addPlugin(plugin)
    })
  }

  addPlugin(plugin: Plugin) {
    if (this.configured) {
      throw new Error('JBrowse already configured, cannot add plugins')
    }
    if (this.plugins.includes(plugin)) {
      throw new Error('plugin already installed')
    }
    // if (!plugin.install) console.error(plugin)
    plugin.install(this)
    this.plugins.push(plugin)
    return this
  }

  configure() {
    if (this.configured) throw new Error('already configured')

    // run the creation callbacks for each element type in order.
    // see elementCreationSchedule above for the creation order
    this.elementCreationSchedule.run()
    delete this.elementCreationSchedule

    this.plugins.forEach(plugin => plugin.configure(this))

    this.configured = true

    // console.log(JSON.stringify(getSnapshot(model)))

    return this
  }

  getElementTypeRecord(
    groupName: PluggableElementTypeGroup,
  ): TypeRecord<PluggableElementBase> {
    switch (groupName) {
      case 'adapter':
        return this.adapterTypes
      case 'connection':
        return this.connectionTypes
      case 'drawer widget':
        return this.drawerWidgetTypes
      case 'menu bar':
        return this.menuBarTypes
      case 'renderer':
        return this.rendererTypes
      case 'track':
        return this.trackTypes
      case 'view':
        return this.viewTypes
    }
    throw new Error(`invalid group name ${groupName}`)
  }

  addElementType(
    groupName: PluggableElementTypeGroup,
    creationCallback: (pluginManager: PluginManager) => PluggableElementType,
  ) {
    if (typeof creationCallback !== 'function') {
      throw new Error(
        'must provide a callback function that returns the new type object',
      )
    }
    const typeRecord = this.getElementTypeRecord(groupName)

    this.elementCreationSchedule.add(groupName, () => {
      const newElement = creationCallback(this)

      if (typeRecord.has(newElement.name)) {
        throw new Error(
          `${groupName} ${newElement.name} already registered, cannot register it again`,
        )
      }

      typeRecord.add(newElement.name, newElement)
    })

    return this
  }

  getElementType(groupName: PluggableElementTypeGroup, typeName: string) {
    const typeRecord = this.getElementTypeRecord(groupName)
    return typeRecord.get(typeName)
  }

  getElementTypesInGroup(groupName: PluggableElementTypeGroup) {
    const typeRecord = this.getElementTypeRecord(groupName)
    return typeRecord.all()
  }

  getElementTypeMembers(
    groupName: PluggableElementTypeGroup,
    memberName: string,
  ) {
    return this.getElementTypesInGroup(groupName)
      .map(t => t[memberName])
      .filter(m => !!m)
  }

  /** get a MST type for the union of all specified pluggable MST types */
  pluggableMstType(
    typeGroup: PluggableElementTypeGroup,
    fieldName: PluggableElementMember,
    fallback = types.maybe(types.null),
  ) {
    const pluggableTypes = this.getElementTypeMembers(typeGroup, fieldName)
    // try to smooth over the case when no types are registered, mostly encountered in tests
    if (pluggableTypes.length === 0) {
      console.warn(
        `No JBrowse pluggable types found matching ('${typeGroup}','${fieldName}'), returning null type`,
      )
      return fallback
    }
    return types.union(...pluggableTypes)
  }

  /** get a MST type for the union of all specified pluggable config schemas */
  pluggableConfigSchemaType(
    typeGroup: PluggableElementTypeGroup,
    fieldName: PluggableElementMember = 'configSchema',
    fallback = ConfigurationSchema('Null', {}),
  ) {
    return this.pluggableMstType(typeGroup, fieldName, fallback)
  }

  jbrequireCache = new Map()

  /**
   * Get the re-exported version of the given package name.
   * Throws an error if the package is not re-exported by the plugin manager.
   *
   * @returns {any} the library's default export
   */
  jbrequire = (
    lib: string | Function | { default: Function },
  ): { [exportName: string]: any } => {
    if (typeof lib === 'string') {
      const pack = ReExports[lib]
      if (!pack)
        throw new Error(
          `No jbrequire re-export defined for package '${lib}'. If this package must be shared between plugins, add it to ReExports.js. If it does not need to be shared, just import it normally.`,
        )
      return pack
    }

    if (typeof lib === 'function') {
      if (!this.jbrequireCache.has(lib)) this.jbrequireCache.set(lib, lib(this))
      return this.jbrequireCache.get(lib)
    }

    if (lib.default) return this.jbrequire(lib.default)

    throw new TypeError(
      'lib passed to jbrequire must be either a string or a function',
    )
  }

  getRendererType(typeName: string): RendererType {
    return this.rendererTypes.get(typeName)
  }

  getAdapterType(typeName: string): AdapterType {
    return this.adapterTypes.get(typeName)
  }

  getTrackType(typeName: string): TrackType {
    return this.trackTypes.get(typeName)
  }

  getViewType(typeName: string): ViewType {
    return this.viewTypes.get(typeName)
  }

  getDrawerWidgetType(typeName: string): DrawerWidgetType {
    return this.drawerWidgetTypes.get(typeName)
  }

  getMenuBarType(typeName: string): MenuBarType {
    return this.menuBarTypes.get(typeName)
  }

  getConnectionType(typeName: string): ConnectionType {
    return this.connectionTypes.get(typeName)
  }

  addRendererType(
    creationCallback: (pluginManager: PluginManager) => RendererType,
  ): this {
    return this.addElementType('renderer', creationCallback)
  }

  addAdapterType(
    creationCallback: (pluginManager: PluginManager) => AdapterType,
  ): this {
    return this.addElementType('adapter', creationCallback)
  }

  addTrackType(
    creationCallback: (pluginManager: PluginManager) => TrackType,
  ): this {
    return this.addElementType('track', creationCallback)
  }

  addViewType(
    creationCallback: (pluginManager: PluginManager) => ViewType,
  ): this {
    return this.addElementType('view', creationCallback)
  }

  addDrawerWidgetType(
    creationCallback: (pluginManager: PluginManager) => DrawerWidgetType,
  ): this {
    return this.addElementType('drawer widget', creationCallback)
  }

  addMenuBarType(
    creationCallback: (pluginManager: PluginManager) => MenuBarType,
  ): this {
    return this.addElementType('menu bar', creationCallback)
  }

  addConnectionType(
    creationCallback: (pluginManager: PluginManager) => ConnectionType,
  ): this {
    return this.addElementType('connection', creationCallback)
  }
}
