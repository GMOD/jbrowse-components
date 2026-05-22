import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyAdapter } from '../data_adapters/BaseAdapter/index.ts'

export default class TextSearchAdapterType extends PluggableElementBase {
  getAdapterClass: () => Promise<AnyAdapter>

  configSchema: AnyConfigurationSchemaType

  description?: string

  // `AdapterClass` is retained for backward compatibility with third-party
  // plugins; new code should prefer `getAdapterClass` for code splitting.
  constructor(
    stuff: {
      name: string
      configSchema: AnyConfigurationSchemaType
      displayName?: string
      description?: string
    } & (
      | { getAdapterClass: () => Promise<AnyAdapter> }
      | { AdapterClass: AnyAdapter }
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
