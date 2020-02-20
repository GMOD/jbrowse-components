import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { getDefaultValue } from '../util/mst-reflection'
import { ConfigurationSchemaType } from '../configuration/configurationSchema'

export default class TrackType extends PluggableElementBase {
  compatibleView = 'LinearGenomeView'

  stateModel: IAnyModelType

  configSchema: ConfigurationSchemaType

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    configSchema: ConfigurationSchemaType
    compatibleView: string
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for track ${this.name}`)
    }
    if (!this.configSchema) {
      throw new Error(`no configSchema provided for track ${this.name}`)
    }
    if (!getDefaultValue(this.configSchema).type) {
      const name = this.configSchema ? this.configSchema.name : 'UNKNOWN'
      throw new Error(`${name} is not explicitlyTyped`)
    }
  }
}
