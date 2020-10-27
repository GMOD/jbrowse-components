import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { getDefaultValue } from '../util/mst-reflection'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AnyReactComponentType } from '../util'

export default class TrackType extends PluggableElementBase {
  compatibleView = 'LinearGenomeView'

  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  ReactComponent: AnyReactComponentType

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    configSchema: AnyConfigurationSchemaType
    compatibleView: string
    ReactComponent: AnyReactComponentType
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    this.ReactComponent = stuff.ReactComponent
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for track ${this.name}`)
    }
    if (!this.configSchema) {
      throw new Error(`no configSchema provided for track ${this.name}`)
    }
    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent provided for track ${this.name}`)
    }
    if (!getDefaultValue(this.configSchema).type) {
      const name = this.configSchema ? this.configSchema.name : 'UNKNOWN'
      throw new Error(`${name} is not explicitlyTyped`)
    }
  }
}
