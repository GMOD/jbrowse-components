/* eslint curly:error */
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AnyAdapter } from '../data_adapters/BaseAdapter'

export default class AdapterType extends PluggableElementBase {
  AdapterClass?: AnyAdapter

  getAdapterClass: () => Promise<AnyAdapter>

  configSchema: AnyConfigurationSchemaType

  adapterCapabilities: string[]

  constructor(
    stuff: {
      name: string
      configSchema: AnyConfigurationSchemaType
      adapterCapabilities?: string[]
    } & (
      | { AdapterClass: AnyAdapter }
      | { getAdapterClass: () => Promise<AnyAdapter> }
    ),
  ) {
    super(stuff)
    if ('AdapterClass' in stuff) {
      this.getAdapterClass = async () => stuff.AdapterClass
    } else if ('getAdapterClass' in stuff) {
      this.getAdapterClass = stuff.getAdapterClass
    } else {
      throw new Error(
        `no AdapterClass or getAdapterClass is defined for adapter type ${this.name}`,
      )
    }
    this.configSchema = stuff.configSchema
    this.adapterCapabilities = stuff.adapterCapabilities || []
  }
}
