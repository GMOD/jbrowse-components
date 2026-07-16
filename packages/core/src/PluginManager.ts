import type { ComponentType } from 'react'

import { isModelType, isType, types } from '@jbrowse/mobx-state-tree'

import CorePlugin from './CorePlugin.ts'
import PhasedScheduler from './PhasedScheduler.ts'
import ReExports from './ReExports/index.ts'
import {
  ConfigurationSchema,
  isBareConfigurationSchemaType,
} from './configuration/index.ts'
import createJexlInstance from './util/jexl.ts'

import type Plugin from './Plugin.ts'
import type { PluginDefinition } from './PluginLoader.ts'
import type AdapterType from './pluggableElementTypes/AdapterType.ts'
import type AddTrackWorkflowType from './pluggableElementTypes/AddTrackWorkflowType.ts'
import type ConnectionType from './pluggableElementTypes/ConnectionType.ts'
import type DisplayType from './pluggableElementTypes/DisplayType.ts'
import type InternetAccountType from './pluggableElementTypes/InternetAccountType.ts'
import type PluggableElementBase from './pluggableElementTypes/PluggableElementBase.ts'
import type RpcMethodType from './pluggableElementTypes/RpcMethodType.ts'
import type TextSearchAdapterType from './pluggableElementTypes/TextSearchAdapterType.ts'
import type TrackType from './pluggableElementTypes/TrackType.ts'
import type ViewType from './pluggableElementTypes/ViewType.ts'
import type WidgetType from './pluggableElementTypes/WidgetType.ts'
import type { PluggableElementType } from './pluggableElementTypes/index.ts'
import type {
  AbstractRootModel,
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from './util/index.ts'
import type {
  IAnyModelType,
  IAnyStateTreeNode,
  IAnyType,
} from '@jbrowse/mobx-state-tree'

type PluggableElementTypeGroup =
  | 'adapter'
  | 'display'
  | 'track'
  | 'connection'
  | 'view'
  | 'widget'
  | 'rpc method'
  | 'internet account'
  | 'text search adapter'
  | 'add track workflow'

/** internal class that holds the info for a certain element type */
class TypeRecord<ElementClass extends PluggableElementBase> {
  registeredTypes: Record<string, ElementClass> = {}
  typeName: string

  constructor(typeName: string) {
    this.typeName = typeName
  }

  add(name: string, t: ElementClass) {
    this.registeredTypes[name] = t
  }

  has(name: string) {
    return name in this.registeredTypes
  }

  get(name: string) {
    const type = this.registeredTypes[name]
    if (!type) {
      throw new Error(
        `${this.typeName} '${name}' not found, perhaps its plugin is not loaded or its plugin has not added it.`,
      )
    }
    return type
  }

  all() {
    return Object.values(this.registeredTypes)
  }
}

type AnyFunction = (...args: any) => any
type ExtensionPointCallback = (
  extendee: unknown,
  props?: Record<string, unknown>,
) => unknown

// Typed registry for extension points, mirroring RpcRegistry. Plugins augment
// this interface via declaration merging so the addToExtensionPoint /
// evaluateExtensionPoint / evaluateAsyncExtensionPoint overloads narrow per
// extension point name.
//
// Each entry declares:
//   args:   the value passed as `extendee` (also the accumulator type)
//   result: the value each callback must return
//   props:  (optional) the read-only context object passed unchanged to every
//           callback. Use for notification-style points where the payload
//           should not be mutated between callbacks.
//
// Extension points are accumulator-style: every callback receives the previous
// callback's return value as its first arg, so for side-effect points
// (LaunchView-*, etc.) declare `result` equal to `args` and return the args
// unchanged so subsequent callbacks see the original payload.
//
// Example augmentation in a plugin:
//
//   declare module '@jbrowse/core/PluginManager' {
//     interface ExtensionPointRegistry {
//       'LaunchView-LinearGenomeView': {
//         args: LaunchArgs
//         result: LaunchArgs
//         props: { session: AbstractSessionModel } // optional
//       }
//     }
//   }
//
// Untyped extension points still work — they hit the second overload of each
// method and fall back to the prior loose typing. Built-in points defined here
// in PluginManager are declared inline; points owned by other modules augment
// this interface via `declare module '@jbrowse/core/PluginManager'`.
// a feature-detail widget carries trackId/trackType (undefined when the
// producing track was closed), which is what lets a panel scope itself to a
// track
type FeatureWidgetModel = IAnyStateTreeNode & {
  trackId?: string
  trackType?: string
}

// any widget additionally exposes its type discriminator, which scopes a
// replacement to a kind of widget
type WidgetModel = FeatureWidgetModel & {
  type: string
}

// props passed to Core-extraFeaturePanel components (and threaded as the second
// arg to each accumulating callback)
export interface FeaturePanelProps {
  model: FeatureWidgetModel
  feature: SimpleFeatureSerialized
}

// props passed to Core-replaceWidget components
export interface ReplaceWidgetProps {
  session: AbstractSessionModel
  model: WidgetModel
  toolbarHeight?: number
}

export interface ExtensionPointRegistry {
  'Core-extendPluggableElement': {
    args: PluggableElementType
    result: PluggableElementType
  }
  // accumulates an array of panels — every callback appends its own component
  // (scoping itself via the model) and returns the array, so multiple plugins
  // compose instead of overwriting one another
  'Core-extraFeaturePanel': {
    args: ComponentType<FeaturePanelProps>[]
    result: ComponentType<FeaturePanelProps>[]
    props: FeaturePanelProps
  }
  // singular: one widget renders, so this stays a single-component fold. A
  // callback returns its own component to replace/wrap the default, or the
  // default unchanged to opt out
  'Core-replaceWidget': {
    args: ComponentType<ReplaceWidgetProps>
    result: ComponentType<ReplaceWidgetProps>
    props: ReplaceWidgetProps
  }
}

export type ExtensionPointName = keyof ExtensionPointRegistry

export type ExtensionPointArgs<N extends ExtensionPointName> =
  ExtensionPointRegistry[N]['args']

export type ExtensionPointResult<N extends ExtensionPointName> =
  ExtensionPointRegistry[N]['result']

export type ExtensionPointProps<N extends ExtensionPointName> =
  'props' extends keyof ExtensionPointRegistry[N]
    ? ExtensionPointRegistry[N]['props']
    : Record<string, unknown>

/**
 * metadata related to the instance of this plugin. `isCore` is set when the
 * plugin was loaded as part of the "core" set of plugins for this application,
 * and `url` records the resolved location it was loaded from. The index
 * signature keeps it free-form so other things about why the plugin is loaded
 * (where it came from, what depends on it, etc.) can be stashed too.
 */
export interface PluginMetadata {
  isCore?: boolean
  url?: string
  [key: string]: unknown
}

export interface PluginLoadRecord {
  metadata?: PluginMetadata
  plugin: Plugin
}
export interface RuntimePluginLoadRecord extends PluginLoadRecord {
  definition: PluginDefinition
}

export default class PluginManager {
  plugins: Plugin[] = []

  jexl = createJexlInstance()

  pluginMetadata: Record<string, PluginMetadata> = {}

  runtimePluginDefinitions: PluginDefinition[] = []

  elementCreationSchedule = new PhasedScheduler<PluggableElementTypeGroup>(
    'adapter',
    'text search adapter',
    'display',
    'track',
    'connection',
    'view',
    'widget',
    'rpc method',
    'internet account',
    'add track workflow',
  )

  pluggableElementsCreated = false

  adapterTypes = new TypeRecord<AdapterType>('AdapterType')

  textSearchAdapterTypes = new TypeRecord<TextSearchAdapterType>(
    'TextSearchAdapterType',
  )

  trackTypes = new TypeRecord<TrackType>('TrackType')

  displayTypes = new TypeRecord<DisplayType>('DisplayType')

  connectionTypes = new TypeRecord<ConnectionType>('ConnectionType')

  viewTypes = new TypeRecord<ViewType>('ViewType')

  widgetTypes = new TypeRecord<WidgetType>('WidgetType')

  rpcMethods = new TypeRecord<RpcMethodType>('RpcMethodType')

  addTrackWidgets = new TypeRecord<AddTrackWorkflowType>('AddTrackWorkflow')

  internetAccountTypes = new TypeRecord<InternetAccountType>(
    'InternetAccountType',
  )

  configured = false

  rootModel?: AbstractRootModel

  extensionPoints = new Map<string, ExtensionPointCallback[]>()

  /**
   * Lazy-hydration cache for `TrackConfigurationReference`/
   * `DisplayConfigurationReference` (configuration/configurationSchema.ts).
   * `jbrowse.tracks` is `types.frozen` for large-tracklist performance, so a
   * track config is a plain JS object until first referenced; hydrating it
   * into an MST node is deferred to that read. MST's custom-reference
   * `getValue` has no memoization of its own — it reruns on every property
   * access — so without this cache, every read of `track.configuration` would
   * fabricate a fresh, non-identical MST node. Keyed by schemaType (each track
   * type's config schema is rebuilt fresh per PluginManager instance, see
   * addTrackType) then by the frozen object itself, so a cache hit can only
   * ever come from this same PluginManager instance and this same track type.
   * See ADR-031.
   *
   * This node is never mutated: admin edits replace the frozen entry (new
   * identity drops the WeakMap entry), and a non-admin's edits go to a private
   * session working copy, not here (ADR-032). Both levels are `WeakMap`s so
   * entries collect normally — no manual invalidation needed.
   */
  trackConfigHydrationCache = new WeakMap<object, WeakMap<object, unknown>>()

  constructor(initialPlugins: (Plugin | PluginLoadRecord)[] = []) {
    // add the core plugin
    this.addPlugin({
      plugin: new CorePlugin(),
      metadata: {
        isCore: true,
      },
    })

    // add all the initial plugins
    for (const plugin of initialPlugins) {
      this.addPlugin(plugin)
    }
  }

  pluginConfigurationNamespacedSchemas() {
    const configurationSchemas: Record<string, unknown> = {}
    for (const plugin of this.plugins) {
      if (plugin.configurationSchema) {
        configurationSchemas[plugin.name] = plugin.configurationSchema
      }
    }
    return configurationSchemas
  }

  pluginConfigurationUnnamespacedSchemas() {
    const configurationSchemas: Record<string, unknown> = {}
    for (const plugin of this.plugins) {
      if (plugin.configurationSchemaUnnamespaced) {
        Object.assign(
          configurationSchemas,
          plugin.configurationSchemaUnnamespaced,
        )
      }
    }
    return configurationSchemas
  }

  pluginConfigurationRootSchemas() {
    const configurationSchemas: Record<string, unknown> = {}
    for (const plugin of this.plugins) {
      if (plugin.rootConfigurationSchema) {
        Object.assign(
          configurationSchemas,
          plugin.rootConfigurationSchema(this),
        )
      }
    }
    return configurationSchemas
  }

  addPlugin(load: Plugin | PluginLoadRecord | RuntimePluginLoadRecord) {
    if (this.configured) {
      throw new Error('JBrowse already configured, cannot add plugins')
    }

    const [plugin, metadata] =
      'plugin' in load
        ? [load.plugin, load.metadata ?? {}]
        : [load, {} as PluginMetadata]

    if (this.plugins.includes(plugin)) {
      throw new Error('plugin already installed')
    }

    this.pluginMetadata[plugin.name] = metadata
    if ('definition' in load) {
      this.runtimePluginDefinitions.push(load.definition)
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

  removePlugin(pluginName: string) {
    const plugin = this.getPlugin(pluginName)
    if (!plugin) {
      throw new Error(`Plugin '${pluginName}' not found`)
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    plugin.uninstall?.(this)
    this.plugins = this.plugins.filter(p => p.name !== pluginName)
    delete this.pluginMetadata[pluginName]
    return this
  }

  createPluggableElements() {
    // run the creation callbacks for each element type in order.
    // see elementCreationSchedule above for the creation order
    if (!this.pluggableElementsCreated) {
      this.elementCreationSchedule.run()
      this.pluggableElementsCreated = true
    }
    return this
  }

  setRootModel(rootModel: AbstractRootModel) {
    this.rootModel = rootModel
    return this
  }

  configure() {
    if (this.configured) {
      throw new Error('already configured')
    }

    for (const plugin of this.plugins) {
      plugin.configure(this)
    }

    this.configured = true

    return this
  }

  getElementTypeRecord(
    groupName: PluggableElementTypeGroup,
  ): TypeRecord<PluggableElementBase> {
    switch (groupName) {
      case 'adapter':
        return this.adapterTypes
      case 'text search adapter':
        return this.textSearchAdapterTypes
      case 'connection':
        return this.connectionTypes
      case 'widget':
        return this.widgetTypes
      case 'display':
        return this.displayTypes
      case 'track':
        return this.trackTypes
      case 'view':
        return this.viewTypes
      case 'rpc method':
        return this.rpcMethods
      case 'internet account':
        return this.internetAccountTypes
      case 'add track workflow':
        return this.addTrackWidgets
      default:
        throw new Error(`invalid element type '${groupName}'`)
    }
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
    if (this.pluggableElementsCreated) {
      throw new Error(
        `Cannot add element type after createPluggableElements() has been called`,
      )
    }
    const typeRecord = this.getElementTypeRecord(groupName)

    this.elementCreationSchedule.add(groupName, () => {
      const newElement = creationCallback(this)
      if (!newElement.name) {
        throw new Error(`cannot add a ${groupName} with no name`)
      }

      if (typeRecord.has(newElement.name)) {
        console.warn(
          `${groupName} ${newElement.name} already registered, cannot register it again`,
        )
      } else {
        typeRecord.add(
          newElement.name,
          this.evaluateExtensionPoint(
            /** #extensionPoint Core-extendPluggableElement | sync | Mutate any pluggable element after it is created */
            'Core-extendPluggableElement',
            newElement,
          ),
        )
      }
    })

    return this
  }

  getElementType(groupName: PluggableElementTypeGroup, typeName: string) {
    return this.getElementTypeRecord(groupName).get(typeName)
  }

  getElementTypesInGroup(groupName: PluggableElementTypeGroup) {
    return this.getElementTypeRecord(groupName).all()
  }

  getViewElements() {
    return this.getElementTypesInGroup('view') as ViewType[]
  }

  getTrackElements() {
    return this.getElementTypesInGroup('track') as TrackType[]
  }

  getConnectionElements() {
    return this.getElementTypesInGroup('connection') as ConnectionType[]
  }

  getAddTrackWorkflowElements() {
    return this.getElementTypesInGroup(
      'add track workflow',
    ) as AddTrackWorkflowType[]
  }

  getRpcElements() {
    return this.getElementTypesInGroup('rpc method') as RpcMethodType[]
  }

  getDisplayElements() {
    return this.getElementTypesInGroup('display') as DisplayType[]
  }

  getAdapterElements() {
    return this.getElementTypesInGroup('adapter') as AdapterType[]
  }

  /** get a MST type for the union of all specified pluggable MST types */
  pluggableMstType(
    groupName: PluggableElementTypeGroup,
    fieldName: string,
    fallback: IAnyType = types.maybe(types.null),
  ) {
    const pluggableTypes = this.getElementTypeRecord(groupName)
      .all()
      .map(t => (t as unknown as Record<string, unknown>)[fieldName])
      .filter(t => isType(t) && isModelType(t)) as IAnyType[]

    if (pluggableTypes.length === 0) {
      return fallback
    }
    return types.union(...pluggableTypes)
  }

  /** get a MST type for the union of all specified pluggable config schemas */
  pluggableConfigSchemaType(
    typeGroup: PluggableElementTypeGroup,
    fieldName = 'configSchema',
  ) {
    const pluggableTypes = this.getElementTypeRecord(typeGroup)
      .all()
      .map(t => (t as unknown as Record<string, unknown>)[fieldName])
      .filter(t => isBareConfigurationSchemaType(t)) as IAnyType[]

    if (pluggableTypes.length === 0) {
      pluggableTypes.push(ConfigurationSchema('Null', {}))
    }
    return types.union(...pluggableTypes) as IAnyModelType
  }

  jbrequireCache = new Map()

  lib = ReExports

  load = <FTYPE extends AnyFunction>(lib: FTYPE): ReturnType<FTYPE> => {
    if (!this.jbrequireCache.has(lib)) {
      this.jbrequireCache.set(lib, lib(this))
    }
    return this.jbrequireCache.get(lib)
  }

  /**
   * Get the re-exported version of the given package name.
   * Throws an error if the package is not re-exported by the plugin manager.
   *
   * @returns the library's default export
   */
  jbrequire = (lib: string | AnyFunction | { default: AnyFunction }): any => {
    if (typeof lib === 'string') {
      const pack = this.lib[lib]

      if (!pack) {
        throw new TypeError(
          `No jbrequire re-export defined for package '${lib}'. If this package must be shared between plugins, add it to ReExports.js. If it does not need to be shared, just import it normally.`,
        )
      }
      return pack
    } else if (typeof lib === 'function') {
      return this.load(lib)
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    else if (lib.default) {
      console.warn('initiated jbrequire on a {default:Function}')
      return this.jbrequire(lib.default)
    }

    throw new TypeError(
      'lib passed to jbrequire must be either a string or a function',
    )
  }

  getAdapterType(typeName: string) {
    return this.adapterTypes.get(typeName)
  }

  getTextSearchAdapterType(typeName: string) {
    return this.textSearchAdapterTypes.get(typeName)
  }

  getTrackType(typeName: string) {
    return this.trackTypes.get(typeName)
  }

  getDisplayType(typeName: string) {
    return this.displayTypes.get(typeName)
  }

  getViewType(typeName: string) {
    return this.viewTypes.get(typeName)
  }

  getAddTrackWorkflow(typeName: string) {
    return this.addTrackWidgets.get(typeName)
  }

  getWidgetType(typeName: string) {
    return this.widgetTypes.get(typeName)
  }

  getConnectionType(typeName: string) {
    return this.connectionTypes.get(typeName)
  }

  getRpcMethodType(methodName: string) {
    return this.rpcMethods.get(methodName)
  }

  getInternetAccountType(name: string) {
    return this.internetAccountTypes.get(name)
  }

  addAdapterType(cb: (pm: PluginManager) => AdapterType) {
    return this.addElementType('adapter', cb)
  }

  addTextSearchAdapterType(cb: (pm: PluginManager) => TextSearchAdapterType) {
    return this.addElementType('text search adapter', cb)
  }

  addTrackType(cb: (pm: PluginManager) => TrackType) {
    // Goes through the already-created displays and registers the ones that
    // specify this track type
    const callback = () => {
      const track = cb(this)
      const displays = this.getElementTypesInGroup('display') as DisplayType[]
      for (const display of displays) {
        // track may have already added the displayType in its cb
        if (
          display.trackType === track.name &&
          !track.displayTypes.includes(display)
        ) {
          track.addDisplayType(display)
        }
      }
      return track
    }
    return this.addElementType('track', callback)
  }

  addDisplayType(cb: (pluginManager: PluginManager) => DisplayType) {
    return this.addElementType('display', cb)
  }

  addViewType(cb: (pluginManager: PluginManager) => ViewType) {
    const callback = () => {
      const newView = cb(this)
      const displays = this.getElementTypesInGroup('display') as DisplayType[]
      for (const display of displays) {
        // view may have already added the displayType in its callback
        // see ViewType for description of extendedName
        if (
          (display.viewType === newView.name ||
            display.viewType === newView.extendedName) &&
          !newView.displayTypes.includes(display)
        ) {
          newView.addDisplayType(display)
        }
      }
      return newView
    }
    return this.addElementType('view', callback)
  }

  addWidgetType(cb: (pm: PluginManager) => WidgetType) {
    return this.addElementType('widget', cb)
  }

  addConnectionType(cb: (pm: PluginManager) => ConnectionType) {
    return this.addElementType('connection', cb)
  }

  addRpcMethod(cb: (pm: PluginManager) => RpcMethodType) {
    return this.addElementType('rpc method', cb)
  }

  addInternetAccountType(cb: (pm: PluginManager) => InternetAccountType) {
    return this.addElementType('internet account', cb)
  }

  addAddTrackWorkflowType(cb: (pm: PluginManager) => AddTrackWorkflowType) {
    return this.addElementType('add track workflow', cb)
  }

  addToExtensionPoint<N extends ExtensionPointName>(
    extensionPointName: N,
    callback: (
      extendee: ExtensionPointArgs<N>,
      props: ExtensionPointProps<N>,
    ) => ExtensionPointResult<N> | Promise<ExtensionPointResult<N>>,
  ): void
  addToExtensionPoint<T>(
    extensionPointName: string,
    callback: (extendee: T, props: Record<string, unknown>) => T,
  ): void
  addToExtensionPoint(
    extensionPointName: string,
    callback: (extendee: unknown, props: Record<string, unknown>) => unknown,
  ) {
    let callbacks = this.extensionPoints.get(extensionPointName)
    if (!callbacks) {
      callbacks = []
      this.extensionPoints.set(extensionPointName, callbacks)
    }
    callbacks.push(callback as ExtensionPointCallback)
  }

  evaluateExtensionPoint<N extends ExtensionPointName>(
    extensionPointName: N,
    extendee: ExtensionPointArgs<N>,
    props?: ExtensionPointProps<N>,
  ): ExtensionPointResult<N>
  evaluateExtensionPoint(
    extensionPointName: string,
    extendee: unknown,
    props?: Record<string, unknown>,
  ): unknown
  evaluateExtensionPoint(
    extensionPointName: string,
    extendee: unknown,
    props?: Record<string, unknown>,
  ) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          accumulator = callback(accumulator, props)
        } catch (error) {
          console.error(error)
        }
      }
    }
    return accumulator
  }

  evaluateAsyncExtensionPoint<N extends ExtensionPointName>(
    extensionPointName: N,
    extendee: ExtensionPointArgs<N>,
    props?: ExtensionPointProps<N>,
  ): Promise<ExtensionPointResult<N>>
  evaluateAsyncExtensionPoint(
    extensionPointName: string,
    extendee: unknown,
    props?: Record<string, unknown>,
  ): Promise<unknown>
  async evaluateAsyncExtensionPoint(
    extensionPointName: string,
    extendee: unknown,
    props?: Record<string, unknown>,
  ) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          accumulator = await callback(accumulator, props)
        } catch (error) {
          console.error(error)
        }
      }
    }
    return accumulator
  }
}
