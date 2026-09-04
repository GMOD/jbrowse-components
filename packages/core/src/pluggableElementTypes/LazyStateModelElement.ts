import PluggableElementBase from './PluggableElementBase.ts'

import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

/**
 * A pluggable element whose state model may arrive through a dynamic import.
 * Code that can run before any instance exists — session preloading, pruning,
 * union membership — checks `isStateModelLoaded` before reading `stateModel`.
 */
export default abstract class LazyStateModelElement extends PluggableElementBase {
  protected abstract readonly group: 'view' | 'display'

  private loadedStateModel?: IAnyModelType

  private stateModelPromise?: Promise<IAnyModelType>

  private pendingStateModelExtensions: ((
    stateModel: IAnyModelType,
  ) => IAnyModelType)[] = []

  // named `stateModel` + `Loader` because pluggableMstType probes
  // `${fieldName}Loader` generically
  stateModelLoader?: () => Promise<IAnyModelType>

  // set by PluginManager.addElementType: runs Core-extendPluggableElement once
  // the loader resolves, so a callback reading `stateModel` sees a model
  onStateModelLoaded?: () => void

  constructor(stuff: {
    name: string
    displayName?: string
    aliases?: string[]
    stateModel: IAnyModelType | (() => Promise<IAnyModelType>)
  }) {
    super(stuff)
    if (typeof stuff.stateModel === 'function') {
      this.stateModelLoader = stuff.stateModel
    } else {
      this.loadedStateModel = stuff.stateModel
    }
  }

  // Throws before the loader resolves, so a plugin composing an unloaded
  // model fails here rather than as an opaque MST error.
  get stateModel(): IAnyModelType {
    this.assertStateModelLoaded()
    return this.loadedStateModel!
  }

  set stateModel(stateModel: IAnyModelType) {
    this.loadedStateModel = stateModel
  }

  get isStateModelLoaded() {
    return this.loadedStateModel !== undefined
  }

  assertStateModelLoaded() {
    if (this.loadedStateModel === undefined) {
      const getter = this.group === 'view' ? 'getViewType' : 'getDisplayType'
      throw new Error(
        `state model for ${this.group} type ${this.name} is not loaded yet — await ${getter}('${this.name}').loadStateModel() first`,
      )
    }
  }

  loadStateModel() {
    if (this.loadedStateModel !== undefined) {
      return Promise.resolve(this.loadedStateModel)
    }
    if (!this.stateModelLoader) {
      throw new Error(
        `${this.group} type ${this.name} has neither a state model nor a loader`,
      )
    }
    this.stateModelPromise ??= this.stateModelLoader().then(loaded => {
      let stateModel = loaded
      for (const extend of this.pendingStateModelExtensions) {
        stateModel = extend(stateModel)
      }
      this.pendingStateModelExtensions = []
      this.loadedStateModel = stateModel
      this.onStateModelLoaded?.()
      return this.stateModel
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
