import PluggableElementBase from './PluggableElementBase'
import type { AnyConfigurationSchemaType } from '../configuration/types'
import type { IAnyModelType } from 'mobx-state-tree'

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
  }
}
