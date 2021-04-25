import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AdapterConstructor } from '../data_adapters/BaseAdapter'

export default class TextSearchAdapterType extends PluggableElementBase {
  AdapterClass: AdapterConstructor

  configSchema: AnyConfigurationSchemaType

  description?: string

  constructor(stuff: {
    name: string
    description?: string
    configSchema: AnyConfigurationSchemaType
    AdapterClass: AdapterConstructor
  }) {
    super(stuff)
    this.description = stuff.description
    this.configSchema = stuff.configSchema
    this.AdapterClass = stuff.AdapterClass
    if (!this.AdapterClass) {
      throw new Error(`no AdapterClass defined for adapter type ${this.name}`)
    }
  }
}
