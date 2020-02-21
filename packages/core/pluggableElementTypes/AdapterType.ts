import PluggableElementBase from './PluggableElementBase'
import { ConfigurationSchemaType } from '../configuration/configurationSchema'
import BaseAdapter from '../BaseAdapter'

interface AdapterImplementation extends BaseAdapter {
  new (...args: any[]): this
}
export default class AdapterType extends PluggableElementBase {
  AdapterClass: AdapterImplementation

  configSchema: ConfigurationSchemaType

  constructor(stuff: {
    name: string
    AdapterClass: AdapterImplementation
    configSchema: ConfigurationSchemaType
  }) {
    super(stuff)
    this.AdapterClass = stuff.AdapterClass
    this.configSchema = stuff.configSchema
    if (!this.AdapterClass) {
      throw new Error(`no AdapterClass defined for adapter type ${this.name}`)
    }
  }
}
