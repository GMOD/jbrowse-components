import PluggableElementBase from './PluggableElementBase'
import BaseAdapter from '../BaseAdapter'
import { ConfigurationSchemaType } from '../configuration/configurationSchema'

export default class AdapterType extends PluggableElementBase {
  AdapterClass: typeof BaseAdapter

  configSchema: ConfigurationSchemaType

  constructor(stuff: {
    name: string
    AdapterClass: typeof BaseAdapter
    configSchema: ConfigurationSchemaType
  }) {
    super(stuff)
    this.AdapterClass = stuff.AdapterClass
    this.configSchema = stuff.configSchema
    if (!this.AdapterClass) {
      throw new Error(`no AdapterClass defined for adapter type ${this.name}`)
    }

    if (!this.AdapterClass.capabilities.length) {
      throw new Error(
        `Adapter class ${this.AdapterClass.name} must provide a static property "capabilities" that has at least one entry. See BaseAdapter for an example.`,
      )
    }
  }
}
