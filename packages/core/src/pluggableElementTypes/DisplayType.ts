import LazyStateModelElement from './LazyStateModelElement.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyReactComponentType } from '../util/index.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default class DisplayType extends LazyStateModelElement {
  protected readonly group = 'display'

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
    this.configSchema = stuff.configSchema
    this.ReactComponent = stuff.ReactComponent
    this.trackType = stuff.trackType
    this.viewType = stuff.viewType
    this.helpText = stuff.helpText
  }
}
