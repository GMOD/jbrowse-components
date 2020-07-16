import {
  types,
  IAnyType,
  IAnyModelType,
  isModelType,
  isType,
} from 'mobx-state-tree'

import PluggableElementBase from './pluggableElementTypes/PluggableElementBase'
import RendererType from './pluggableElementTypes/renderers/RendererType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import ViewType from './pluggableElementTypes/ViewType'
import WidgetType from './pluggableElementTypes/WidgetType'
import ConnectionType from './pluggableElementTypes/ConnectionType'
import RpcMethodType from './pluggableElementTypes/RpcMethodType'

import {
  ConfigurationSchema,
  isBareConfigurationSchemaType,
} from './configuration'

import Plugin from './Plugin'
import ReExports from './ReExports'

import {
  PluggableElementType,
  PluggableElementMember,
} from './pluggableElementTypes'
import { AnyConfigurationSchemaType } from './configuration/configurationSchema'
import { AbstractRootModel } from './util'
import CorePlugin from './CorePlugin'

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
  | 'rpc method'

/** internal class that holds the info for a certain element type */
class TypeRecord<ElementClass extends PluggableElementBase> {
  registeredTypes: { [name: string]: ElementClass } = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseClass: { new (...args: any[]): ElementClass }

  typeName: string

  constructor(
    typeName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elementType: { new (...args: any[]): ElementClass },
  ) {
    this.typeName = typeName
    this.baseClass = elementType
  }

  add(name: string, t: ElementClass) {
    this.registeredTypes[name] = t
  }

  has(name: string) {
    return name in this.registeredTypes
  }

  get(name: string) {
    if (!this.has(name))
      throw new Error(
        `${this.typeName} '${name}' not found, perhaps its plugin is not loaded or its plugin has not added it.`,
      )
    return this.registeredTypes[name]
  }

  all() {
    return Object.values(this.registeredTypes)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any) => any

export default class PluginManager {
  plugins: Plugin[] = []

  elementCreationSchedule = new PhasedScheduler<PluggableElementTypeGroup>(
    'renderer',
    'adapter',
    'track',
    'connection',
    'view',
    'drawer widget',
    'rpc method',
  )

  rendererTypes = new TypeRecord('RendererType', RendererType)

  adapterTypes = new TypeRecord('AdapterType', AdapterType)

  trackTypes = new TypeRecord('TrackType', TrackType)

  connectionTypes = new TypeRecord('ConnectionType', ConnectionType)

  viewTypes = new TypeRecord('ViewType', ViewType)

  widgetTypes = new TypeRecord('WidgetType', WidgetType)

  rpcMethods = new TypeRecord('RpcMethodType', RpcMethodType)

  configured = false

  rootModel?: AbstractRootModel

  constructor(initialPlugins: Plugin[] = []) {
    // add the core plugin
    this.addPlugin(new CorePlugin())

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
    plugin.install(this)
    this.plugins.push(plugin)
    return this
  }

  getPlugin(name: string) {
    return this.plugins.find(p => p.name === name)
  }

  hasPlugin(name: string) {
    return this.getPlugin(name) !== undefined
  }

  createPluggableElements() {
    // run the creation callbacks for each element type in order.
    // see elementCreationSchedule above for the creation order
    this.elementCreationSchedule.run()
    delete this.elementCreationSchedule
    return this
  }

  setRootModel(rootModel: AbstractRootModel) {
    this.rootModel = rootModel
  }

  configure() {
    if (this.configured) throw new Error('already configured')

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
        return this.widgetTypes
      case 'renderer':
        return this.rendererTypes
      case 'track':
        return this.trackTypes
      case 'view':
        return this.viewTypes
      case 'rpc method':
        return this.rpcMethods
    }
    throw new Error(`invalid element type '${groupName}'`)
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
      if (!newElement.name)
        throw new Error(`cannot add a ${groupName} with no name`)

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

  /** get a MST type for the union of all specified pluggable MST types */
  pluggableMstType(
    typeGroup: PluggableElementTypeGroup,
    fieldName: PluggableElementMember,
    fallback: IAnyType = types.maybe(types.null),
  ) {
    const pluggableTypes: IAnyModelType[] = []
    this.getElementTypeRecord(typeGroup)
      .all()
      .forEach(t => {
        const thing = t[fieldName]
        if (isType(thing) && isModelType(thing)) {
          pluggableTypes.push(thing)
        }
      })
    // try to smooth over the case when no types are registered, mostly encountered in tests
    if (pluggableTypes.length === 0) {
      console.warn(
        `No JBrowse pluggable types found matching ('${typeGroup}','${fieldName}')`,
      )
      return fallback
    }
    return types.union(...pluggableTypes)
  }

  /** get a MST type for the union of all specified pluggable config schemas */
  pluggableConfigSchemaType(
    typeGroup: PluggableElementTypeGroup,
    fieldName: PluggableElementMember = 'configSchema',
  ) {
    const pluggableTypes: AnyConfigurationSchemaType[] = []
    this.getElementTypeRecord(typeGroup)
      .all()
      .forEach(t => {
        const thing = t[fieldName]
        if (isBareConfigurationSchemaType(thing)) {
          pluggableTypes.push(thing)
        }
      })
    if (pluggableTypes.length === 0)
      pluggableTypes.push(ConfigurationSchema('Null', {}))
    return types.union(...pluggableTypes)
  }

  jbrequireCache = new Map()

  lib = ReExports

  load = <FTYPE extends AnyFunction>(lib: FTYPE): ReturnType<FTYPE> => {
    if (!this.jbrequireCache.has(lib)) this.jbrequireCache.set(lib, lib(this))
    return this.jbrequireCache.get(lib)
  }

  /**
   * Get the re-exported version of the given package name.
   * Throws an error if the package is not re-exported by the plugin manager.
   *
   * @returns the library's default export
   */
  jbrequire = (
    lib: keyof typeof ReExports | AnyFunction | { default: AnyFunction },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any => {
    if (typeof lib === 'string') {
      const pack = this.lib[lib]
      if (!pack) {
        throw new TypeError(
          `No jbrequire re-export defined for package '${lib}'. If this package must be shared between plugins, add it to ReExports.js. If it does not need to be shared, just import it normally.`,
        )
      }
      return pack
    }

    if (typeof lib === 'function') {
      return this.load(lib)
    }

    if (lib.default) return this.jbrequire(lib.default)

    throw new TypeError(
      'lib passed to jbrequire must be either a string or a function',
    )
  }

  getRendererType(typeName: string): RendererType {
    return this.rendererTypes.get(typeName)
  }

  getRendererTypes(): RendererType[] {
    return this.rendererTypes.all()
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

  getWidgetType(typeName: string): WidgetType {
    return this.widgetTypes.get(typeName)
  }

  getConnectionType(typeName: string): ConnectionType {
    return this.connectionTypes.get(typeName)
  }

  getRpcMethodType(methodName: string): RpcMethodType {
    return this.rpcMethods.get(methodName)
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

  addWidgetType(
    creationCallback: (pluginManager: PluginManager) => WidgetType,
  ): this {
    return this.addElementType('drawer widget', creationCallback)
  }

  addConnectionType(
    creationCallback: (pluginManager: PluginManager) => ConnectionType,
  ): this {
    return this.addElementType('connection', creationCallback)
  }

  addRpcMethod(
    creationCallback: (pluginManager: PluginManager) => RpcMethodType,
  ): this {
    return this.addElementType('rpc method', creationCallback)
  }
}
