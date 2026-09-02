import PluggableElementBase from './PluggableElementBase.ts'

import type { LaunchKeyRegistration } from '../util/withLaunchInput.ts'
import type DisplayType from './DisplayType.ts'
import type { IAnyModelType, IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

type BasicView = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?

  model: any
  session?: IAnyStateTreeNode
}>

type ViewComponentType = React.LazyExoticComponent<BasicView> | BasicView

interface ViewMetadata {
  hiddenFromGUI?: boolean
}

export default class ViewType extends PluggableElementBase {
  ReactComponent: ViewComponentType

  private loadedStateModel?: IAnyModelType

  // Non-optional because nearly every reader holds a view instance, which
  // implies the model is loaded; code that can run before any instance exists
  // (session preloading, pruning, union membership) must check
  // isStateModelLoaded first.
  get stateModel(): IAnyModelType {
    return this.loadedStateModel!
  }

  // named `stateModel` + `Loader` because pluggableMstType and
  // pruneUnbuildableNodes probe `${fieldName}Loader` generically
  stateModelLoader?: () => Promise<IAnyModelType>

  private stateModelPromise?: Promise<IAnyModelType>

  private pendingStateModelExtensions: ((
    stateModel: IAnyModelType,
  ) => IAnyModelType)[] = []

  // What `withLaunchInput` partitioned out of this view's snapshots, published
  // beside the model so an out-of-tree plugin, the doc generator and the
  // validator read one declaration rather than each keeping a list.
  launchKeys?: LaunchKeyRegistration<unknown, string>

  displayTypes: DisplayType[] = []

  viewMetadata: ViewMetadata = {}

  // extendedName can be used for when you extend a given view type, and want
  // to register all of that view types displays to yourself
  //
  // e.g. you create a linear-genome-view subtype, and want all the tracks that
  // are compatible display types for the linear-genome-view to be compatible
  // with your type also (without this, display types are only registered to a
  // single view type)
  extendedName?: string

  constructor(stuff: {
    name: string
    displayName?: string
    stateModel: IAnyModelType | (() => Promise<IAnyModelType>)
    launchKeys?: LaunchKeyRegistration<unknown, string>
    extendedName?: string
    viewMetadata?: ViewMetadata
    ReactComponent: ViewComponentType
    aliases?: string[]
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.viewMetadata = stuff.viewMetadata ?? {}
    if (typeof stuff.stateModel === 'function') {
      this.stateModelLoader = stuff.stateModel
    } else {
      this.loadedStateModel = stuff.stateModel
    }
    this.launchKeys = stuff.launchKeys
    this.extendedName = stuff.extendedName
  }

  /**
   * Every key this view accepts written on the view object — its declared MST
   * properties plus the launch keys above. `undefined` for a view that
   * registers none: nothing there says which of its launcher's arguments are
   * settings, so a caller must classify nothing rather than call them all typos.
   * Also `undefined` while a lazily registered state model is not loaded yet,
   * for the same reason: nothing is known, so nothing is a typo.
   *
   * This is the set `withLaunchInput`'s partition reads off the same two
   * declarations, published for the surfaces that never build a view snapshot —
   * a session spec launches straight through `LaunchView-<type>`.
   */
  get acceptedKeys() {
    const properties = this.loadedStateModel?.properties as
      | Record<string, unknown>
      | undefined
    return this.launchKeys && properties
      ? [
          ...Object.keys(properties),
          ...Object.keys(this.launchKeys.keys),
          ...this.launchKeys.passThrough,
        ]
      : undefined
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
        `view type ${this.name} has neither a state model nor a loader`,
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

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
