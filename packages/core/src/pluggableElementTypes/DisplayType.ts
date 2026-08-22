import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyReactComponentType } from '../util/index.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default class DisplayType extends PluggableElementBase {
  // Set at construction for an eager registration, and when the loader
  // resolves for a lazy one — the same shape as ViewType. Declared
  // non-optional (the getter asserts) because nearly every runtime reader
  // operates on a display instance that already exists; code that can run
  // before any instance exists (session preloading, pruning, union
  // membership) must check isStateModelLoaded or go through loadStateModel.
  private loadedStateModel?: IAnyModelType

  get stateModel(): IAnyModelType {
    return this.loadedStateModel!
  }

  // Present only for lazy registrations; named `stateModel` + `Loader` so the
  // generic group machinery (pluggableMstType, pruneUnbuildableNodes) can
  // probe `${fieldName}Loader` without knowing about DisplayType.
  stateModelLoader?: () => Promise<IAnyModelType>

  private stateModelPromise?: Promise<IAnyModelType>

  // Extensions (extendDisplayType) that arrived before the loader resolved;
  // they compose onto the loaded model in registration order.
  private pendingStateModelExtensions: ((
    stateModel: IAnyModelType,
  ) => IAnyModelType)[] = []

  configSchema: AnyConfigurationSchemaType

  ReactComponent: AnyReactComponentType

  /**
   * The track type the display is associated with
   */
  trackType: string

  /*
   * Indicates that this display type can be a "sub-display" of another type of
   * display, e.g. in AlignmentsDisplay, has Pileup and SNPCoverage subDisplays
   */
  subDisplay?: {
    type: string
    [key: string]: unknown
  }

  /**
   * The view type the display is associated with
   */
  viewType: string

  /**
   * Help text describing the display type
   */
  helpText?: string

  /**
   * Older display type names that should be remapped to this one when loading
   * sessions/configs. Each entry is the legacy `type` value previously used.
   * Per-display `preProcessSnapshot` hooks then handle any property migrations
   * within the renamed type. For migrations that rewrite the value of an
   * existing constrained slot (enum rename, type narrow), use
   * `addDisplayConfigMigration` instead — see that helper for why.
   */
  aliases?: string[]

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType | (() => Promise<IAnyModelType>)
    trackType: string
    viewType: string
    displayName?: string
    subDisplay?: { type: string; [key: string]: unknown }
    configSchema: AnyConfigurationSchemaType
    ReactComponent: AnyReactComponentType
    helpText?: string
    aliases?: string[]
  }) {
    super(stuff)
    if (typeof stuff.stateModel === 'function') {
      this.stateModelLoader = stuff.stateModel
    } else {
      this.loadedStateModel = stuff.stateModel
    }
    this.subDisplay = stuff.subDisplay
    this.configSchema = stuff.configSchema
    this.ReactComponent = stuff.ReactComponent
    this.trackType = stuff.trackType
    this.viewType = stuff.viewType
    this.helpText = stuff.helpText
    this.aliases = stuff.aliases
  }

  get isStateModelLoaded() {
    return this.loadedStateModel !== undefined
  }

  loadStateModel() {
    if (this.loadedStateModel !== undefined) {
      return Promise.resolve(this.loadedStateModel)
    }
    if (!this.stateModelLoader) {
      throw new Error(
        `display type ${this.name} has neither a state model nor a loader`,
      )
    }
    this.stateModelPromise ??= this.stateModelLoader().then(loaded => {
      let stateModel = loaded
      for (const extend of this.pendingStateModelExtensions) {
        stateModel = extend(stateModel)
      }
      this.pendingStateModelExtensions = []
      this.loadedStateModel = stateModel
      return stateModel
    })
    return this.stateModelPromise
  }

  extendStateModel(extend: (stateModel: IAnyModelType) => IAnyModelType) {
    if (this.loadedStateModel !== undefined) {
      this.loadedStateModel = extend(this.loadedStateModel)
    } else {
      this.pendingStateModelExtensions.push(extend)
    }
  }
}
