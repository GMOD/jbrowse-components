import PluggableElementBase from './PluggableElementBase.ts'

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

  // Set at construction for an eager registration, and when the loader
  // resolves for a lazy one.
  private loadedStateModel?: IAnyModelType

  // Declared non-optional (the getter asserts) because nearly every runtime
  // reader operates on a view instance that already exists, which implies the
  // model is loaded; code that can run before any instance exists (session
  // preloading, pruning, union membership) must check isStateModelLoaded or go
  // through loadStateModel. At runtime an unloaded type reads as undefined,
  // which is what lets pluggableMstType's membership thunk filter it out.
  get stateModel(): IAnyModelType {
    return this.loadedStateModel!
  }

  // Present only for lazy registrations, and named `stateModel` + `Loader` so
  // generic group machinery (pluggableMstType, pruneUnbuildableNodes) can
  // probe `${fieldName}Loader` without knowing about ViewType specifically.
  stateModelLoader?: () => Promise<IAnyModelType>

  private stateModelPromise?: Promise<IAnyModelType>

  // Extensions (extendViewType) that arrived before the loader resolved; they
  // compose onto the loaded model in registration order.
  private pendingStateModelExtensions: ((
    stateModel: IAnyModelType,
  ) => IAnyModelType)[] = []

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
    extendedName?: string
    viewMetadata?: ViewMetadata
    ReactComponent: ViewComponentType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.viewMetadata = stuff.viewMetadata ?? {}
    if (typeof stuff.stateModel === 'function') {
      this.stateModelLoader = stuff.stateModel
    } else {
      this.loadedStateModel = stuff.stateModel
    }
    this.extendedName = stuff.extendedName
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
