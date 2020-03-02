import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AdapterConstructor } from '../data_adapters/BaseAdapter'

export default class AdapterType extends PluggableElementBase {
  AdapterClass: AdapterConstructor

  configSchema: AnyConfigurationSchemaType

  constructor(stuff: {
    name: string
    AdapterClass: AdapterConstructor
    configSchema: AnyConfigurationSchemaType
  }) {
    super(stuff)
    this.AdapterClass = stuff.AdapterClass
    this.configSchema = stuff.configSchema
    if (!this.AdapterClass) {
      throw new Error(`no AdapterClass defined for adapter type ${this.name}`)
    }
  }
}
