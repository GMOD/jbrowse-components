import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyAdapter } from '../data_adapters/BaseAdapter/index.ts'

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

  /**
   * Normalize a raw adapter config snapshot (plain JSON, before MST
   * instantiation). Adapters that support shorthand notation (e.g. just
   * `{type, uri}`) should expand it here to the canonical form so that
   * downstream code can read location keys without knowing each shorthand.
   */
  normalizeSnapshot?: (snap: Record<string, unknown>) => Record<string, unknown>

  /**
   * The config key holding the adapter's primary file location (e.g.
   * `'vcfGzLocation'`). Setting this opts the adapter into any feature that
   * reads tracks by their primary file — such as "Open from track" in the
   * spreadsheet / SV inspector.
   */
  locationKey?: string

  // `AdapterClass` is retained for backward compatibility with third-party
  // plugins that pass an eager class reference; new code should prefer
  // `getAdapterClass` for code splitting.
  constructor(
    stuff: {
      name: string
      configSchema: AnyConfigurationSchemaType
      displayName?: string
      adapterCapabilities?: string[]
      adapterMetadata?: AdapterMetadata
      normalizeSnapshot?: (
        snap: Record<string, unknown>,
      ) => Record<string, unknown>
      locationKey?: string
    } & (
      | { getAdapterClass: () => Promise<AnyAdapter> }
      | { AdapterClass: AnyAdapter }
    ),
  ) {
    super(stuff)
    this.getAdapterClass =
      'getAdapterClass' in stuff
        ? stuff.getAdapterClass
        : async () => stuff.AdapterClass
    this.configSchema = stuff.configSchema
    this.adapterCapabilities = stuff.adapterCapabilities ?? []
    this.adapterMetadata = stuff.adapterMetadata
    this.normalizeSnapshot = stuff.normalizeSnapshot
    this.locationKey = stuff.locationKey
  }
}
