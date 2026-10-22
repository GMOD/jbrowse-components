import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AdapterClassFor } from '../data_adapters/BaseAdapter/index.ts'

export default class TextSearchAdapterType<
  SCHEMA extends AnyConfigurationSchemaType = any,
> extends PluggableElementBase {
  getAdapterClass: () => Promise<AdapterClassFor<SCHEMA>>

  configSchema: SCHEMA

  description?: string

  constructor(
    stuff: {
      name: string
      configSchema: SCHEMA
      displayName?: string
      description?: string
    } & (
      | { getAdapterClass: () => Promise<AdapterClassFor<SCHEMA>> }
      | {
          /**
           * @deprecated pass `getAdapterClass`, which loads the class on first
           * use. Still read for the prebuilt plugin bundles that register with
           * it.
           */
          AdapterClass: AdapterClassFor<SCHEMA>
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
