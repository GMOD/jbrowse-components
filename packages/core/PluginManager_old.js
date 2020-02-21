import { types } from 'mobx-state-tree'

import RendererType from './pluggableElementTypes/renderers/RendererType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import ViewType from './pluggableElementTypes/ViewType'
import DrawerWidgetType from './pluggableElementTypes/DrawerWidgetType'
import MenuBarType from './pluggableElementTypes/MenuBarType'
import ConnectionType from './pluggableElementTypes/ConnectionType'

import { ConfigurationSchema } from './configuration'

import ReExports from './ReExports'

// little helper class that keeps groups of callbacks that are
// then run in a specified order by group
class PhasedScheduler {
  phaseCallbacks = {}

  constructor(...phaseOrder) {
    this.phaseOrder = phaseOrder
  }

  add(phase, callback) {
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

export default class PluginManager {
  plugins = []

  elementTypes = {}

  elementCreationSchedule = new PhasedScheduler(
    'renderer',
    'adapter',
    'track',
    'connection',
    'view',
    'drawer widget',
    'menu bar',
  )

  typeBaseClasses = {
    renderer: RendererType,
    adapter: AdapterType,
    track: TrackType,
    connection: ConnectionType,
    view: ViewType,
    'drawer widget': DrawerWidgetType,
    'menu bar': MenuBarType,
  }

  constructor(initialPlugins = []) {
    this.lib = PluginManager.lib

    this.getRendererType = this.getElementType.bind(this, 'renderer')
    this.getAdapterType = this.getElementType.bind(this, 'adapter')
    this.getTrackType = this.getElementType.bind(this, 'track')
    this.getViewType = this.getElementType.bind(this, 'view')
    this.getDrawerWidgetType = this.getElementType.bind(this, 'drawer widget')
    this.getMenuBarType = this.getElementType.bind(this, 'menu bar')
    this.getConnectionType = this.getElementType.bind(this, 'connection')
    this.addRendererType = this.addElementType.bind(this, 'renderer')
    this.addAdapterType = this.addElementType.bind(this, 'adapter')
    this.addTrackType = this.addElementType.bind(this, 'track')
    this.addViewType = this.addElementType.bind(this, 'view')
    this.addDrawerWidgetType = this.addElementType.bind(this, 'drawer widget')
    this.addMenuBarType = this.addElementType.bind(this, 'menu bar')
    this.addConnectionType = this.addElementType.bind(this, 'connection')

    // add all the initial plugins
    initialPlugins.forEach(plugin => {
      this.addPlugin(plugin)
    })
  }

  jbrequireCache = new Map()

  /**
   * Get the re-exported version of the given package name.
   * Throws an error if the package is not re-exported by the plugin manager.
   *
   * @param {Array[string]} packageNames
   * @returns {any} the library's default export
   */
  jbrequire = lib => {
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

  addPlugin(plugin) {
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

  /** get a MST type for the union of all specified pluggable MST types */
  pluggableMstType(typeGroup, fieldName, fallback = types.maybe(types.null)) {
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
    typeGroup,
    fieldName = 'configSchema',
    fallback = ConfigurationSchema('Null', {}),
  ) {
    return this.pluggableMstType(typeGroup, fieldName, fallback)
  }

  addElementType(groupName, creationCallback) {
    if (typeof creationCallback !== 'function') {
      throw new Error(
        'must provide a callback function that returns the new type object',
      )
    }
    const typeBaseClass = this.typeBaseClasses[groupName]
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

  getElementType(groupName, typeName) {
    if (!typeName) {
      throw new Error(`invalid type name "${typeName}"`)
    }
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
