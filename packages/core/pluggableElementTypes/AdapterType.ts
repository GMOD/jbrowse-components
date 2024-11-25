import PluggableElementBase from './PluggableElementBase'
import type { AnyConfigurationSchemaType } from '../configuration'
import type { AnyAdapter } from '../data_adapters/BaseAdapter'

export interface AdapterMetadata {
  category?: string
  hiddenFromGUI?: boolean
  description?: string
}

export default class AdapterType extends PluggableElementBase {
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
      | {
          AdapterClass: AnyAdapter
        }
      | {
          getAdapterClass: () => Promise<AnyAdapter>
        }
    ),
  ) {
    super(stuff)
    this.getAdapterClass =
      'AdapterClass' in stuff
        ? async () => stuff.AdapterClass
        : stuff.getAdapterClass
    this.configSchema = stuff.configSchema
    this.adapterCapabilities = stuff.adapterCapabilities || []
    this.adapterMetadata = stuff.adapterMetadata
  }
}
