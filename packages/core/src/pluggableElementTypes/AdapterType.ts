import { getConfigurationSchemaMetadata } from '../configuration/schemaRegistry.ts'
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

  private declaredNormalizeSnapshot?: NormalizeSnapshot

  /**
   * Normalize a raw adapter config snapshot (plain JSON, before MST
   * instantiation). Adapters that support shorthand notation (e.g. just
   * `{type, uri}`) expand it to the canonical form so downstream code can read
   * location keys without knowing each shorthand.
   *
   * **Defaults to the config schema's own `preProcessSnapshot`**, which is the
   * function that already runs when MST builds the config, so an adapter
   * declaring the shorthand once gets both. It used to be a second, separate
   * registration, and five in-tree adapters had only the schema half
   * (`MafTabixAdapter`, `BgzipMafAdapter`, `BgzipTaffyAdapter`,
   * `AllVsAllPAFAdapter`, `MCScanBlocksAdapter`) — which reads as working,
   * because loading such a config from a URL goes through the schema. Only
   * `normalizeAdapterSnapshots` consults *this*, so what broke was `localFiles`
   * in the embedded products: the shorthand stayed unexpanded, `uri` never
   * became a location node, and the blob substitution silently found nothing to
   * substitute.
   *
   * Pass one explicitly only to normalize *differently* here than at MST
   * create, which nothing in tree needs.
   */
  get normalizeSnapshot(): NormalizeSnapshot | undefined {
    return (
      this.declaredNormalizeSnapshot ??
      getConfigurationSchemaMetadata(this.configSchema)?.options
        .preProcessSnapshot
    )
  }

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
    this.declaredNormalizeSnapshot = stuff.normalizeSnapshot
    this.locationKey = stuff.locationKey
  }
}
