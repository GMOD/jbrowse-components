import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration'
import { AnyAdapter } from '../data_adapters/BaseAdapter'

export default class TextSearchAdapterType extends PluggableElementBase {
  AdapterClass: AnyAdapter

  configSchema: AnyConfigurationSchemaType

  description?: string

  constructor(stuff: {
    name: string
    displayName?: string
    description?: string
    configSchema: AnyConfigurationSchemaType
    AdapterClass: AnyAdapter
  }) {
    super(stuff)
    this.description = stuff.description
    this.configSchema = stuff.configSchema
    this.AdapterClass = stuff.AdapterClass
  }
}
