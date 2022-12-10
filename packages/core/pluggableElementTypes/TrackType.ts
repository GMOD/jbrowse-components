import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { getDefaultValue } from '../util/mst-reflection'
import { AnyConfigurationSchemaType } from '../configuration'
import DisplayType from './DisplayType'

export default class TrackType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  displayTypes: DisplayType[] = []

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    displayName?: string
    configSchema: AnyConfigurationSchemaType
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

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
