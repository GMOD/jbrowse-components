/* eslint curly:error */
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { BaseAdapter } from '../data_adapters/BaseAdapter'

export default class AdapterType extends PluggableElementBase {
  AdapterClass?: typeof BaseAdapter

  getAdapterClass?: () => Promise<typeof BaseAdapter>

  configSchema: AnyConfigurationSchemaType

  adapterCapabilities: string[]

  constructor(
    stuff: {
      name: string
      configSchema: AnyConfigurationSchemaType
      adapterCapabilities?: string[]
    } & (
      | { AdapterClass: typeof BaseAdapter }
      | { getAdapterClass: () => Promise<typeof BaseAdapter> }
    ),
  ) {
    super(stuff)
    if ('AdapterClass' in stuff) {
      this.AdapterClass = stuff.AdapterClass
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
