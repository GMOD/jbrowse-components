import { types } from 'mobx-state-tree'

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

// little helper class that keeps groups of callbacks that are
// then run in a specified order by group
class PhasedScheduler {
  phaseCallbacks: Record<string, Function[]> = {}

  phaseOrder: string[] = []

  constructor(...phaseOrder: string[]) {
    this.phaseOrder = phaseOrder
  }

  add(phase: string, callback: Function) {
    if (!this.phaseOrder.includes(phase)) {
      throw new Error(`unknown phase ${phase}`)
    }
    if (!this.phaseCallbacks[phase]) this.phaseCallbacks[phase] = []
    this.phaseCallbacks[phase].push(callback)
  }

  run() {
    this.phaseOrder.forEach(phaseName => {
      if (this.phaseCallbacks[phaseName]) {
        this.phaseCallbacks[phaseName].forEach(callback => callback())
      }
    })
  }
}

const typeBaseClasses = {
  renderer: RendererType,
  adapter: AdapterType,
  track: TrackType,
  connection: ConnectionType,
  view: ViewType,
  'drawer widget': DrawerWidgetType,
  'menu bar': MenuBarType,
}

export default class PluginManager {
  plugins: Plugin[] = []

  elementCreationSchedule = new PhasedScheduler(
    'renderer',
    'adapter',
    'track',
    'connection',
    'view',
    'drawer widget',
    'menu bar',
  )

  elementTypes: Record<string, Record<string, PluggableElementType>> = {}

  configured = false

  getRendererType: (typeName: string) => any

  getAdapterType: (typeName: string) => any

  getTrackType: (typeName: string) => any

  getViewType: (typeName: string) => any

  getDrawerWidgetType: (typeName: string) => any

  getMenuBarType: (typeName: string) => any

  getConnectionType: (typeName: string) => any

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

  constructor(initialPlugins = []) {
    this.getRendererType = this.getElementType.bind(this, 'renderer')
    this.getAdapterType = this.getElementType.bind(this, 'adapter')
    this.getTrackType = this.getElementType.bind(this, 'track')
    this.getViewType = this.getElementType.bind(this, 'view')
    this.getDrawerWidgetType = this.getElementType.bind(this, 'drawer widget')
    this.getMenuBarType = this.getElementType.bind(this, 'menu bar')
    this.getConnectionType = this.getElementType.bind(this, 'connection')

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

  addElementType(
    groupName: keyof typeof typeBaseClasses,
    creationCallback: (pluginManager: PluginManager) => PluggableElementType,
  ) {
    if (typeof creationCallback !== 'function') {
      throw new Error(
        'must provide a callback function that returns the new type object',
      )
    }
    const typeBaseClass = typeBaseClasses[groupName]
    if (!typeBaseClass) {
      throw new Error(`unknown pluggable element type ${groupName}, cannot add`)
    }
    if (!this.elementTypes[groupName]) this.elementTypes[groupName] = {}

    this.elementCreationSchedule.add(groupName, () => {
      const element = creationCallback(this)

      if (this.elementTypes[groupName][element.name]) {
        throw new Error(
          `${groupName} ${element.name} already registered, cannot register it again`,
        )
      }

      this.elementTypes[groupName][element.name] = element
    })

    return this
  }

  getElementType(groupName: string, typeName: string) {
    if (!typeName) {
      throw new Error(`invalid type name "${typeName}"`)
    }
    return (this.elementTypes[groupName] || {})[typeName]
  }

  getElementTypesInGroup(groupName: string) {
    return Object.values(this.elementTypes[groupName] || {})
  }

  getElementTypeMembers(groupName: string, memberName: PluggableElementMember) {
    return this.getElementTypesInGroup(groupName)
      .map(t => t[memberName])
      .filter(m => !!m)
  }

  /** get a MST type for the union of all specified pluggable MST types */
  pluggableMstType(
    typeGroup: string,
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
    typeGroup: string,
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
}
