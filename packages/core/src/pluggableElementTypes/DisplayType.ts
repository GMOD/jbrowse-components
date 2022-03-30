import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyReactComponentType } from '../util'
import { getDefaultValue } from '../util/mst-reflection'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'

export default class DisplayType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  ReactComponent: AnyReactComponentType

  trackType: string

  viewType: string

  constructor(stuff: {
    name: string;
    stateModel: IAnyModelType;
    trackType: string;
    viewType: string;
    configSchema: AnyConfigurationSchemaType;
    ReactComponent: AnyReactComponentType;
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    this.ReactComponent = stuff.ReactComponent
    this.trackType = stuff.trackType
    this.viewType = stuff.viewType
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for display ${this.name}`)
    }
    if (!this.configSchema) {
      throw new Error(`no configSchema provided for display ${this.name}`)
    }
    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent provided for display ${this.name}`)
    }
    if (!this.trackType) {
      throw new Error(`no trackType provided for display ${this.name}`)
    }
    if (!this.viewType) {
      throw new Error(`no viewType provided for display ${this.name}`)
    }
    if (!getDefaultValue(this.configSchema).type) {
      const name = this.configSchema ? this.configSchema.name : 'UNKNOWN'
      throw new Error(`${name} is not explicitlyTyped`)
    }
  }
}
