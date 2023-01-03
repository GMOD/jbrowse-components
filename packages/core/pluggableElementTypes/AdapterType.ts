import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AnyAdapter } from '../data_adapters/BaseAdapter'

export type AdapterMetadata = {
  category?: string
  hiddenFromGUI?: boolean
  description?: string
}

export default class AdapterType extends PluggableElementBase {
  AdapterClass?: AnyAdapter

  getAdapterClass: () => Promise<AnyAdapter>

  configSchema: AnyConfigurationSchemaType

  adapterCapabilities: string[]

  adapterMetadata?: AdapterMetadata

  constructor(
    stuff: {
      name: string
      configSchema: AnyConfigurationSchemaType
      displayName?: string
      adapterCapabilities?: string[]
      adapterMetadata?: AdapterMetadata
    } & (
      | { AdapterClass: AnyAdapter }
      | { getAdapterClass: () => Promise<AnyAdapter> }
    ),
  ) {
    super(stuff)
    if ('AdapterClass' in stuff) {
      this.AdapterClass = stuff.AdapterClass
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
    this.adapterMetadata = stuff.adapterMetadata
  }
}
