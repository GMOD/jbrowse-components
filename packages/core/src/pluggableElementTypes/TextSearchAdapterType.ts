import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyAdapter } from '../data_adapters/BaseAdapter/index.ts'

export default class TextSearchAdapterType extends PluggableElementBase {
  getAdapterClass: () => Promise<AnyAdapter>

  configSchema: AnyConfigurationSchemaType

  description?: string

  constructor(
    stuff: {
      name: string
      displayName?: string
      description?: string
      configSchema: AnyConfigurationSchemaType
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
    this.description = stuff.description
    this.configSchema = stuff.configSchema
    this.getAdapterClass =
      'getAdapterClass' in stuff
        ? stuff.getAdapterClass
        : async () => stuff.AdapterClass
  }
}
