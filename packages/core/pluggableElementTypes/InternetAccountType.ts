import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { getDefaultValue } from '../util/mst-reflection'
import { AnyConfigurationSchemaType } from '../configuration/types'

export default class InternetAccountType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    configSchema: AnyConfigurationSchemaType
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    if (!this.stateModel) {
      throw new Error(
        `no stateModel defined for internet account type ${this.name}`,
      )
    }
    if (!this.configSchema) {
      throw new Error(
        `no configSchema provided for internet account type ${this.name}`,
      )
    }
    if (!getDefaultValue(this.configSchema).type) {
      const name = this.configSchema ? this.configSchema.name : 'UNKNOWN'
      throw new Error(`${name} is not explicitlyTyped`)
    }
  }
}
