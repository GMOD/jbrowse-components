import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyReactComponentType } from '../util/index.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default class DisplayType extends PluggableElementBase {
  private loadedStateModel?: IAnyModelType

  // same contract as ViewType.stateModel
  get stateModel(): IAnyModelType {
    return this.loadedStateModel!
  }

  set stateModel(stateModel: IAnyModelType) {
    this.loadedStateModel = stateModel
  }

  // set by PluginManager.addElementType: runs Core-extendPluggableElement once
  // the loader resolves, so a callback reading `stateModel` sees a model
  onStateModelLoaded?: () => void

  stateModelLoader?: () => Promise<IAnyModelType>

  private stateModelPromise?: Promise<IAnyModelType>

  private pendingStateModelExtensions: ((
    stateModel: IAnyModelType,
  ) => IAnyModelType)[] = []

  configSchema: AnyConfigurationSchemaType

  ReactComponent: AnyReactComponentType

  /**
   * The track type the display is associated with
   */
  trackType: string

  /**
   * The view type the display is associated with
   */
  viewType: string

  /**
   * Help text describing the display type
   */
  helpText?: string

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType | (() => Promise<IAnyModelType>)
    trackType: string
    viewType: string
    displayName?: string
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
    this.configSchema = stuff.configSchema
    this.ReactComponent = stuff.ReactComponent
    this.trackType = stuff.trackType
    this.viewType = stuff.viewType
    this.helpText = stuff.helpText
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
