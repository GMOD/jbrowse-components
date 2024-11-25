import PluggableElementBase from './PluggableElementBase'
import type { AnyConfigurationSchemaType } from '../configuration'
import type { AnyReactComponentType } from '../util'
import type { IAnyModelType } from 'mobx-state-tree'

export default class DisplayType extends PluggableElementBase {
  stateModel: IAnyModelType

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

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    trackType: string
    viewType: string
    displayName?: string
    subDisplay?: { type: string; [key: string]: unknown }
    configSchema: AnyConfigurationSchemaType
    ReactComponent: AnyReactComponentType
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.subDisplay = stuff.subDisplay
    this.configSchema = stuff.configSchema
    this.ReactComponent = stuff.ReactComponent
    this.trackType = stuff.trackType
    this.viewType = stuff.viewType
  }
}
