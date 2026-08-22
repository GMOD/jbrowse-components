import { isModelType, isType, types } from '@jbrowse/mobx-state-tree'

import CorePlugin from './CorePlugin.ts'
import PhasedScheduler from './PhasedScheduler.ts'
import { getReExportRegistry } from './ReExports/registry.ts'
import {
  ConfigurationSchema,
  isBareConfigurationSchemaType,
} from './configuration/index.ts'
import createJexlInstance from './util/jexl.ts'

import type Plugin from './Plugin.ts'
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
// Side-effect type imports, for the augmentations rather than for a name. Every
// plugin's `install`/`configure` takes a PluginManager, so a declaration this
// module pulls in is one every plugin's program contains — and a registry
// declaration only constrains a caller whose program already contains the module
// it lives in. Without these, `addToExtensionPoint` falls to its untyped
// overload for a point declared elsewhere in core and infers the parameter from
// whatever the callback claims, which is how jbrowse-plugin-apollo kept a
// `Core-extendWorker` callback typed against a handle shape that had not existed
// for months. Reachability was tracking which modules a plugin happened to
// import for other reasons, not which points are plugin-facing.
import type {} from './pluggableElementTypes/models/migrateTrackConfig.ts'
import type { PluginDefinition } from './pluginDefinitions.ts'
import type {} from './rpc/WebWorkerRpcDriver.ts'
import type {} from './ui/buildExtraTrackMenuItems.ts'
import type {} from './ui/multiTrackMenuItems.ts'
import type {} from './util/addTrackComponent.ts'
import type {
  AbstractRootModel,
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from './util/index.ts'
import type {} from './util/tracks.ts'
import type {
  IAnyModelType,
  IStateTreeNode,
  IAnyType,
} from '@jbrowse/mobx-state-tree'
import type { ComponentType, ReactNode } from 'react'

export type PluggableElementTypeGroup =
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

  // The message a build with the wrong plugin set gets, and usually the ONLY
  // one. The lookups that reach here are mostly registration-time and
  // cross-plugin — `pm.getDisplayType('LinearAlignmentsDisplay')` from a track's
  // install — so in an embedded product, whose consumer supplies the plugin
  // array, this throw is what lands in `pluginManagerError` and replaces the
  // whole app. Naming the missing type alone still leaves "which plugin" to
  // guess, which is what the registered list answers: a build short one plugin
  // is visibly short that plugin's group of names.
  get(name: string) {
    const type = this.registeredTypes[name]
    if (!type) {
      throw new Error(
        `${this.typeName} '${name}' is not registered: a plugin providing it either failed to load or is not in this build's plugin list. Registered ${this.typeName}s: ${this.registeredNames()}`,
      )
    }
    return type
  }

  registeredNames() {
    const names = Object.keys(this.registeredTypes).sort()
    if (names.length === 0) {
      // distinguishable from "the plugin is missing", and a different bug: a
      // getter called before createPluggableElements() sees every record empty
      return 'none at all, so this ran before createPluggableElements()'
    }
    const shown = names.slice(0, 25)
    const rest = names.length - shown.length
    return rest > 0 ? `${shown.join(', ')}, and ${rest} more` : shown.join(', ')
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

/**
 * Marks a component built by wrapping the one the extension point accumulated
 * so far, so {@link PluginManager.evaluateComponentExtensionPoint} can tell
 * composition (two plugins each wrapping, both still visible) from a genuine
 * clobber (a second plugin discarding the first). Set by `wrapComponent`.
 */
export const wrappedComponent = Symbol.for('jbrowse.wrappedComponent')

// a callback that forgets to return hands `undefined` to every later callback
// and to the producer, which is a silent no-op the author has no way to see —
// the accumulator survives instead, since "return what you were passed" is the
// documented way to opt out
function nextAccumulator(name: string, accumulator: unknown, result: unknown) {
  let next = result
  if (result === undefined && accumulator !== undefined) {
    console.warn(
      `a ${name} extension point callback returned undefined instead of the value it was passed, so its result was ignored`,
    )
    next = accumulator
  }
  return next
}

// a bare stack from minified plugin code names nothing, so say which point
function logCallbackError(name: string, error: unknown) {
  console.error(`error in a ${name} extension point callback`, error)
}

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
// Declaring `args` as an array makes the point *accumulating*, which changes
// how plugins register on it: they call contributeToExtensionPoint and return
// only their own entries, never the array. Everything else threads one value
// through addToExtensionPoint, where each callback receives the previous one's
// return value as its first arg — so for side-effect points (LaunchView-*,
// etc.) declare `result` equal to `args` and return the args unchanged so
// subsequent callbacks see the original payload.
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
// A point that resolves to UI names one of the three shapes below instead of
// spelling out the triple, because the shape decides which producer renders it
// and which helper registers on it. Sniffing that back off `args` does not
// work: a TrackTypeGuesser takes an argument and returns a string, so it
// satisfies ComponentType too — extensionPointShapes.test.ts pins the seams
// against it.
//
// Untyped extension points still work — they hit the second overload of each
// method and fall back to the prior loose typing. Built-in points defined here
// in PluginManager are declared inline; points owned by other modules augment
// this interface via `declare module '@jbrowse/core/PluginManager'`.

// #region uiShapes
/**
 * A point that resolves to one component — a slot with a default, which a
 * plugin wraps or replaces. Declared as
 * `'Core-replaceWidget': ComponentSlot<ReplaceWidgetProps>`, produced by
 * {@link PluggableComponent}, registered on with `wrapComponent`.
 */
export interface ComponentSlot<P> {
  args: ComponentType<P>
  result: ComponentType<P>
  props: P
  /**
   * Type-only: never present at runtime, and what makes the shape *declared*
   * rather than guessed. Reading it off the value cannot work — a
   * `TrackTypeGuesser` takes an argument and returns a string, which is also
   * what a function component does, so a structural test admits it as a slot.
   */
  kind: 'componentSlot'
}

/**
 * A point that accumulates an array of components — the panel points. Produced
 * by {@link PluggableComponents}, registered on with
 * {@link PluginManager.contributeToExtensionPoint}; each panel scopes itself
 * and draws its own chrome.
 */
export interface ComponentList<P> {
  args: ComponentType<P>[]
  result: ComponentType<P>[]
  props: P
  /** type-only, see {@link ComponentSlot.kind} */
  kind: 'componentList'
}

/**
 * A point that accumulates already-rendered elements — the overlay points.
 * Produced by {@link PluggableElements}, registered on with
 * `addExtensionElement`, which fixes the React key at registration time.
 */
export interface ElementList<P> {
  args: ReactNode[]
  result: ReactNode[]
  props: P
  /** type-only, see {@link ComponentSlot.kind} */
  kind: 'elementList'
}
// #endregion

/** The names of the points declared as `K`. */
export type PointsOfKind<K extends string> = {
  [N in ExtensionPointName]: ExtensionPointRegistry[N] extends { kind: K }
    ? N
    : never
}[ExtensionPointName]
// a feature-detail widget carries trackId/trackType (undefined when the
// producing track was closed), which is what lets a panel scope itself to a
// track
type FeatureWidgetModel = IStateTreeNode & {
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
// #region featurePanelProps
export interface FeaturePanelProps {
  /** has `trackId` and `trackType` */
  model: FeatureWidgetModel
  /** snapshot of the feature being shown */
  feature: SimpleFeatureSerialized
  /**
   * how far down the subfeature tree this card is: 0 is the feature the user
   * clicked, 1 its subfeatures, and so on. The point fires for every card, so a
   * panel that belongs only on the clicked feature selects on `depth === 0`
   */
  depth: number
}
// #endregion

// props passed to Core-replaceWidget components
// #region replaceWidgetProps
export interface ReplaceWidgetProps {
  session: AbstractSessionModel
  /** has `type`; feature detail widgets also have `trackId` and `trackType` */
  model: WidgetModel
  toolbarHeight?: number
}
// #endregion

/**
 * Typed registries of the view and display types a plugin can extend, in the
 * same shape as {@link ExtensionPointRegistry} and augmented the same way:
 *
 *   declare module '@jbrowse/core/PluginManager' {
 *     interface ViewTypeRegistry {
 *       LinearGenomeView: LinearGenomeViewStateModel
 *     }
 *   }
 *
 * That is what makes `extendViewType(pm, 'LinearGenomeView', …)` hand back a
 * typed state model, and a misspelled or renamed name a compile error rather
 * than an extension that quietly never applies. Declaring them here rather than
 * beside the helpers is load-bearing: an interface can only be augmented
 * through the module that declares it, and a barrel re-exporting the type would
 * give every augmentation its own unrelated copy.
 */
export interface ViewTypeRegistry {}
export interface DisplayTypeRegistry {}

export type ViewTypeName = keyof ViewTypeRegistry
export type DisplayTypeName = keyof DisplayTypeRegistry

export interface ExtensionPointRegistry {
  // the session model type, extended and handed back. Callbacks compose, each
  // building on the model the one before it returned
  'Core-extendSession': {
    args: IAnyModelType
    result: IAnyModelType
  }
  // A notification: a handler works out of band (adding a connection, say) and
  // the assembly turning up is what the manager reacts to. Nothing reads a
  // returned *value* — but an async handler is awaited, which is what tells
  // waitForAssembly it has finished trying, the difference between waiting on
  // an event and waiting on a clock.
  'Core-handleUnrecognizedAssembly': {
    args: undefined
    // the completion signal, not data: an async observer's promise is what a
    // producer awaits to learn that handlers have finished trying
    result: undefined | Promise<void>
    props: {
      assemblyName: string
      /**
       * the session the lookup came from. `unknown` because the assembly
       * manager holds it as the narrow shape it needs rather than the whole
       * session model, and nothing in tree reads it — narrow it yourself if you
       * do
       */
      session?: unknown
    }
  }
  'Core-extendPluggableElement': {
    args: PluggableElementType
    result: PluggableElementType
    // Which kind of element this is. The point fires for every one of them, so
    // without this a callback can only match on `name` and then *assert* the
    // element is the kind that name implies — which is what every hand-written
    // one did, in two independently reinvented lying type guards. `addElementType`
    // has known the group all along; it just never said.
    props: { group: PluggableElementTypeGroup }
  }
  'Core-extraFeaturePanel': ComponentList<FeaturePanelProps>
  // Fired via PluggableComponent's `name` prop (no string-literal call site),
  // so the docs tag lives here at the contract.
  /** #extensionPoint Core-replaceWidget | sync | Replace or wrap the component that renders a widget */
  'Core-replaceWidget': ComponentSlot<ReplaceWidgetProps>
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
 * Points that carry their whole payload in `props` and whose return value
 * nothing reads — a notification rather than a fold. Registered with
 * {@link PluginManager.listenToExtensionPoint}.
 */
export type NotificationPointName = {
  [N in ExtensionPointName]: ExtensionPointArgs<N> extends undefined ? N : never
}[ExtensionPointName]

/**
 * Points whose `args` are an array accumulate: the value threaded through the
 * fold is every plugin's entries so far. They are registered with
 * {@link PluginManager.contributeToExtensionPoint}, never
 * {@link PluginManager.addToExtensionPoint} — see the entry type below for why.
 */
export type AccumulatingPointName = {
  [N in ExtensionPointName]: ExtensionPointArgs<N> extends readonly unknown[]
    ? N
    : never
}[ExtensionPointName]

/** One element of an accumulating point's array — what a plugin contributes. */
export type ExtensionPointEntry<N extends AccumulatingPointName> =
  ExtensionPointArgs<N> extends readonly (infer E)[] ? E : never

/**
 * The trailing `props` parameter of the evaluate methods, required exactly when
 * the point declares one. Omitting it there used to typecheck and then hand
 * `undefined` to every callback, so each one threw on destructuring the props
 * it was promised.
 */
export type ExtensionPointPropsArgs<N extends ExtensionPointName> =
  'props' extends keyof ExtensionPointRegistry[N]
    ? [props: ExtensionPointProps<N>]
    : [props?: Record<string, unknown>]

/**
 * A point name that is *not* in the registry, which is what the loose evaluate
 * overloads accept. Keeping a registered name out of them is what makes the
 * typed overload binding: they otherwise match whenever it doesn't, so a call
 * that omitted a required `props` or passed the wrong `extendee` fell through
 * and compiled. Plugin-defined points, and any name that isn't a literal, are
 * unaffected.
 *
 * A registered name resolves to a message-shaped type rather than `never`
 * because this overload is the last one tried, so its error is the one TS
 * reports: `not assignable to never` says nothing about what to fix.
 */
export type UnregisteredPointName<S extends string> =
  S extends ExtensionPointName
    ? {
        ERROR: 'this extension point is in ExtensionPointRegistry; check the extendee type, and pass props if it declares them'
      }
    : S

/**
 * The same guard for `addToExtensionPoint`'s loose overload. Each excluded kind
 * needs its own message, because the useful thing to say is which method the
 * point does belong to.
 *
 * Excluding those names from the *typed* overload is not enough on its own. The
 * loose overload matches whenever the typed one doesn't, so
 * `addToExtensionPoint('Core-extraFeaturePanel', panels => [MyPanel])` — the one
 * call `contributeToExtensionPoint` exists to make impossible — fell through and
 * compiled, with `T` inferred from whatever the callback returned, dropping every
 * other plugin's panels exactly as if the exclusion weren't there.
 *
 * `S` is inferred from the name, so this binds on the ordinary call. It does not
 * bind when a caller writes the type argument out — `addToExtensionPoint<T>(…)`
 * pins `T` and leaves `S` on its default — which is the price of keeping that
 * arity working for plugins compiled against the older signature.
 */
export type FoldPointName<S extends string> = S extends AccumulatingPointName
  ? {
      ERROR: 'this extension point accumulates a list; register with contributeToExtensionPoint, whose callback returns only its own entries'
    }
  : S extends NotificationPointName
    ? {
        ERROR: 'this extension point is a notification; register with listenToExtensionPoint, which joins async handlers rather than letting the last one registered replace the rest'
      }
    : S extends ExtensionPointName
      ? {
          ERROR: 'this extension point is in ExtensionPointRegistry; check the callback against its args/result types'
        }
      : S

/**
 * metadata related to the instance of this plugin. `isCore` is set when the
 * plugin was loaded as part of the "core" set of plugins for this application,
 * and `url` records the resolved location it was loaded from. The index
 * signature keeps it free-form so other things about why the plugin is loaded
 * (where it came from, what depends on it, etc.) can be stashed too.
 */
export interface PluginMetadata {
  isCore?: boolean
  // Desktop's global plugins: loaded into every session from the user's global
  // list rather than from this config, so the in-session plugin store must not
  // offer to uninstall one — removing it from the config it isn't in silently
  // does nothing.
  isGlobal?: boolean
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

  // singular component points are re-evaluated on every render, so the
  // clobber warning is emitted once per point per app
  warnedClobber = new Set<string>()

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

  constructor(
    initialPlugins: (
      | Plugin
      | PluginLoadRecord
      | RuntimePluginLoadRecord
    )[] = [],
  ) {
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

    // Refuse a second copy of the same plugin, matched by name rather than by
    // object identity: the two copies of a plugin a product bundles AND a
    // config names are different classes from different bundles, so an
    // identity check never sees them.
    //
    // The pluggable-element registry has its own first-wins guard, but a
    // plugin's install()/configure() side effects have none — appendToMenu is a
    // plain push, so a second copy silently doubles that plugin's menu items.
    // Enforcing it here means a product does not have to remember to drop the
    // config entry for everything it vendors.
    //
    // Warn and skip rather than throw. A config naming a plugin some product
    // bundles is a legitimate config — jbrowse.org's hub configs do exactly
    // that, so Web (which bundles less than Desktop) still gets the plugin —
    // and failing the whole session over it would be worse than the duplicate
    // this prevents. First registration wins, which is the core copy, since
    // core plugins are added before a config's.
    if (this.plugins.some(p => p.name === plugin.name)) {
      console.warn(
        `plugin ${plugin.name} is already installed, ignoring the second copy`,
      )
      return this
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
            { group: groupName },
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
    // deliberately unannotated: this really is a union, not a model type, and
    // the `as IAnyModelType` it used to carry was checked against the whole
    // repo and needed by nothing. Claiming model-ness here is also what makes a
    // schema taking its base from this look concrete while its own slot reads
    // have already degraded to `any` — see configuration/CLAUDE.md.
    return types.union(...pluggableTypes)
  }

  jbrequireCache = new Map()

  // populated by PluginLoader once a runtime plugin is actually being loaded,
  // which is the only thing that can call jbrequire — see ReExports/registry.ts
  get lib() {
    return getReExportRegistry()
  }

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
          `No jbrequire re-export defined for package '${lib}'. If this package must be shared between plugins, add it to ReExports/list.ts. If it does not need to be shared, just import it normally.`,
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

  /**
   * Whether an adapter type is registered, for a caller walking a config where
   * `type` names a track, a display and an adapter alike — `getAdapterType`
   * throws on a miss, which is right when the name came from a config that
   * claims to be an adapter and wrong when you are asking whether it is one.
   */
  hasAdapterType(typeName: string) {
    return this.adapterTypes.has(typeName)
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

  /**
   * Contribute entries to an accumulating point.
   *
   * The callback is handed only the props and returns what it wants to add —
   * one entry, several, or `undefined` to add nothing. It never receives the
   * array, which is the whole point: the concatenation happens here, once, so
   * no plugin can write the `[MyEntry]` that silently drops every other
   * plugin's entries. That mistake looked correct to whoever made it, because
   * with one plugin registered there is nothing to drop.
   */
  contributeToExtensionPoint<N extends AccumulatingPointName>(
    extensionPointName: N,
    callback: (
      props: ExtensionPointProps<N>,
    ) => ExtensionPointEntry<N> | ExtensionPointEntry<N>[] | undefined,
  ): void {
    this.pushExtensionPointCallback(extensionPointName, (entries, props) => {
      const contributed = callback(props as ExtensionPointProps<N>)
      const accumulated = entries as ExtensionPointEntry<N>[]
      return contributed === undefined
        ? accumulated
        : [
            ...accumulated,
            ...(Array.isArray(contributed) ? contributed : [contributed]),
          ]
    })
  }

  /**
   * Listen to a notification point — one that carries its payload in `props`
   * and whose return value nothing reads. The callback returns nothing;
   * `addToExtensionPoint` rejects these names, so this is the only way in.
   *
   * The reason it is the only way in is the async join below, not the shorter
   * callback. A handler that works asynchronously states so by returning a
   * promise, and the producer waits on the folded value; written by hand
   * through `addToExtensionPoint`, the second async handler's promise silently
   * replaced the first's, so the producer stopped waiting as soon as the
   * *last*-registered handler finished rather than when they all had. That is
   * not a mistake a plugin author can see, which is why it is not left to them.
   */
  listenToExtensionPoint<N extends NotificationPointName>(
    extensionPointName: N,
    callback: (props: ExtensionPointProps<N>) => void | Promise<void>,
  ): void {
    this.pushExtensionPointCallback(extensionPointName, (extendee, props) => {
      const ret = callback(props as ExtensionPointProps<N>)
      // An async handler is awaited — by evaluateAsyncExtensionPoint, or by a
      // producer that checks the folded value for a thenable to learn when
      // handlers have finished. A sync one passes through whatever an earlier
      // handler left, so its promise is not dropped on the way past.
      //
      // Two async ones are joined rather than the later replacing the earlier;
      // under the sync runner nothing awaits between callbacks. waitForAssembly
      // is the producer that depends on it.
      if (!(ret instanceof Promise)) {
        return extendee
      }
      return extendee instanceof Promise
        ? Promise.all([extendee, ret]).then(() => undefined)
        : ret.then(() => undefined)
    })
  }

  // Accumulating and notification points are both excluded: they go through
  // contributeToExtensionPoint, which owns the concatenation, and
  // listenToExtensionPoint, which owns the async join. Leaving either reachable
  // here would leave the road that quietly does the wrong thing open beside the
  // one that doesn't.
  addToExtensionPoint<
    N extends Exclude<
      ExtensionPointName,
      AccumulatingPointName | NotificationPointName
    >,
  >(
    extensionPointName: N,
    callback: (
      extendee: ExtensionPointArgs<N>,
      props: ExtensionPointProps<N>,
    ) => ExtensionPointResult<N> | Promise<ExtensionPointResult<N>>,
  ): void
  // untyped fallback, for a plugin-defined point; mirrors the typed overload in
  // allowing a promise, since evaluateAsyncExtensionPoint awaits each callback.
  // Registered names are kept out of it — see FoldPointName
  addToExtensionPoint<T, S extends string = string>(
    extensionPointName: FoldPointName<S>,
    callback: (extendee: T, props: Record<string, unknown>) => T | Promise<T>,
  ): void
  addToExtensionPoint(
    extensionPointName: string,
    callback: (extendee: unknown, props: Record<string, unknown>) => unknown,
  ) {
    this.pushExtensionPointCallback(
      extensionPointName,
      callback as ExtensionPointCallback,
    )
  }

  /**
   * The one place a callback joins a point's chain. The three public
   * registration methods go through this rather than through each other:
   * `contributeToExtensionPoint` and `listenToExtensionPoint` register on exactly
   * the point names their own signatures reject, so routing them via
   * `addToExtensionPoint` would either fail to compile or force its guard to be
   * loose enough to let a plugin do the same thing by hand.
   */
  private pushExtensionPointCallback(
    extensionPointName: string,
    callback: ExtensionPointCallback,
  ) {
    // `Core-extendPluggableElement` fires once per element, inside
    // createPluggableElements(). Registering after that run joins a fold that
    // has already happened, so the extension never applies — the same mistake
    // `addElementType` throws on, and the reason it throws: from `configure()`
    // instead of `install()`, an extendViewType call compiles, runs, and
    // silently extends nothing.
    if (
      extensionPointName === 'Core-extendPluggableElement' &&
      this.pluggableElementsCreated
    ) {
      throw new Error(
        "Cannot register on Core-extendPluggableElement after createPluggableElements() has been called: the point has already fired for every element, so this callback would never run. Register it from a plugin's install(), not configure().",
      )
    }
    let callbacks = this.extensionPoints.get(extensionPointName)
    if (!callbacks) {
      callbacks = []
      this.extensionPoints.set(extensionPointName, callbacks)
    }
    callbacks.push(callback)
  }

  evaluateExtensionPoint<N extends ExtensionPointName>(
    extensionPointName: N,
    extendee: ExtensionPointArgs<N>,
    ...props: ExtensionPointPropsArgs<N>
  ): ExtensionPointResult<N>
  evaluateExtensionPoint<S extends string>(
    extensionPointName: UnregisteredPointName<S>,
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
          accumulator = nextAccumulator(
            extensionPointName,
            accumulator,
            callback(accumulator, props),
          )
        } catch (error) {
          logCallbackError(extensionPointName, error)
        }
      }
    }
    return accumulator
  }

  /**
   * Fire a *singular* component point — one where exactly one component can
   * render, so a plugin that returns its own discards whatever the plugin
   * before it returned. Same fold as {@link evaluateExtensionPoint}, plus a
   * one-time warning naming the point when more than one callback genuinely
   * takes the slot. A component built by `wrapComponent` still renders the
   * one it wrapped, so it composes and is not counted.
   *
   * Used by {@link PluggableComponent}; producers should render through that
   * rather than calling this directly.
   */
  evaluateComponentExtensionPoint<N extends ExtensionPointName>(
    extensionPointName: N,
    extendee: ExtensionPointArgs<N>,
    ...props: ExtensionPointPropsArgs<N>
  ): ExtensionPointResult<N>
  evaluateComponentExtensionPoint(
    extensionPointName: string,
    extendee: unknown,
    props?: Record<string, unknown>,
  ) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    let claims = 0
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          const result = nextAccumulator(
            extensionPointName,
            accumulator,
            callback(accumulator, props),
          )
          if (
            result !== accumulator &&
            (result as { [wrappedComponent]?: unknown } | undefined)?.[
              wrappedComponent
            ] !== accumulator
          ) {
            claims++
          }
          accumulator = result
        } catch (error) {
          logCallbackError(extensionPointName, error)
        }
      }
    }
    if (claims > 1 && !this.warnedClobber.has(extensionPointName)) {
      this.warnedClobber.add(extensionPointName)
      console.warn(
        `more than one plugin replaced the ${extensionPointName} slot; only the last one registered is visible. Use a wrapper if the intent was to add to the default rather than replace it`,
      )
    }
    return accumulator
  }

  /**
   * How many callbacks are registered on `extensionPointName`. For a caller
   * that has to tell "every handler declined" apart from "nobody was
   * listening" — the two look identical in the folded result, and
   * assemblyManager waits out the first but not the second.
   */
  extensionPointCallbackCount(extensionPointName: string) {
    return this.extensionPoints.get(extensionPointName)?.length ?? 0
  }

  evaluateAsyncExtensionPoint<N extends ExtensionPointName>(
    extensionPointName: N,
    extendee: ExtensionPointArgs<N>,
    ...props: ExtensionPointPropsArgs<N>
  ): Promise<ExtensionPointResult<N>>
  evaluateAsyncExtensionPoint<S extends string>(
    extensionPointName: UnregisteredPointName<S>,
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
          accumulator = nextAccumulator(
            extensionPointName,
            accumulator,
            await callback(accumulator, props),
          )
        } catch (error) {
          logCallbackError(extensionPointName, error)
        }
      }
    }
    return accumulator
  }

  // Like evaluateAsyncExtensionPoint but does NOT swallow callback errors. The
  // swallow-and-continue in the plain variant suits accumulator points where one
  // plugin failing should not sink the others; side-effecting points (launching
  // a view, etc.) instead want the error to reach the caller so it can be
  // surfaced rather than leaving the user with a silent no-op.
  evaluateAsyncExtensionPointStrict<N extends ExtensionPointName>(
    extensionPointName: N,
    extendee: ExtensionPointArgs<N>,
    ...props: ExtensionPointPropsArgs<N>
  ): Promise<ExtensionPointResult<N>>
  evaluateAsyncExtensionPointStrict<S extends string>(
    extensionPointName: UnregisteredPointName<S>,
    extendee: unknown,
    props?: Record<string, unknown>,
  ): Promise<unknown>
  async evaluateAsyncExtensionPointStrict(
    extensionPointName: string,
    extendee: unknown,
    props?: Record<string, unknown>,
  ) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    if (callbacks) {
      for (const callback of callbacks) {
        accumulator = nextAccumulator(
          extensionPointName,
          accumulator,
          await callback(accumulator, props),
        )
      }
    }
    return accumulator
  }
}
