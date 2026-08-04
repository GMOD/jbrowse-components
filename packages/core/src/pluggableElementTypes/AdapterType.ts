import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyAdapter } from '../data_adapters/BaseAdapter/index.ts'

export interface AdapterMetadata {
  category?: string
  hiddenFromGUI?: boolean
  description?: string
  /**
   * File names this adapter is a valid reading of, but which the extension
   * guess does not hand it — either because another adapter claims the same
   * extension (an all-vs-all PAF looks like any `.paf`) or because no guesser
   * claims it at all.
   *
   * Purely an "Add track" hint: it does not enter
   * `Core-guessAdapterForLocation`, which stays a single first-match-wins chain,
   * so it changes nothing about what a file resolves to headlessly, from the
   * CLI, or in an existing plugin's guesser. What it does is let the form say
   * the alternative exists at the moment the adapter is chosen, instead of
   * leaving it to be found in a dropdown of every adapter JBrowse has.
   *
   * State the fact, not a preference — every adapter naming a pattern is
   * offered together, in registration order, with the guess still selected.
   */
  alsoReads?: RegExp
}

/** Expand a raw adapter config snapshot (plain JSON) to its canonical form. */
export type NormalizeSnapshot = (
  snap: Record<string, unknown>,
) => Record<string, unknown>

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
  normalizeSnapshot?: NormalizeSnapshot

  /**
   * The config key holding the adapter's primary file location (e.g.
   * `'vcfGzLocation'`). Used by import forms to extract the file location from
   * a track's adapter config.
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
      normalizeSnapshot?: NormalizeSnapshot
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
