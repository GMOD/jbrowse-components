import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../../configuration/index.ts'
import type { getSubAdapterType } from '../dataAdapterCache.ts'
import type { AnyDataAdapter } from './util.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export {
  type AnyDataAdapter,
  isFeatureAdapter,
  isRefNameAliasAdapter,
  isRegionsAdapter,
  isSequenceAdapter,
  isTextSearchAdapter,
} from './util.ts'
export type {
  BaseOptions,
  BaseTextSearchArgs,
  LodTier,
  SearchType,
  ZoomRange,
} from './types.ts'
export { BaseAdapter } from './BaseAdapter.ts'
export { cachedSetup } from '../../util/cachedSetup.ts'
export { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter.ts'
export {
  type FeatureDensity,
  densityAdapterConfigSchemaFields,
  isSubAdapterConfig,
} from './featureDensity.ts'
export { BaseSequenceAdapter } from './BaseSequenceAdapter.ts'
export type { BaseTextSearchAdapter } from './BaseTextSearchAdapter.ts'
export type {
  Alias,
  BaseRefNameAliasAdapter,
} from './BaseRefNameAliasAdapter.ts'
export type { RegionsAdapter } from './RegionsAdapter.ts'
export type { CytobandAdapter } from './CytobandAdapter.ts'

/**
 * The adapter class that goes with SCHEMA — the class whose `config` is that
 * schema's node. `AdapterType` is generic over the schema so registering the
 * two together checks that they are the same adapter's; the pairing is
 * otherwise only a shared `type` string, and nothing reports a class reading
 * slots its declared schema never had.
 *
 * see
 * https://www.typescriptlang.org/docs/handbook/2/classes.html#abstract-construct-signatures
 * for why this is the abstract construct signature
 */
export type AdapterClassFor<SCHEMA> = new (
  config: SCHEMA extends AnyConfigurationSchemaType ? Instance<SCHEMA> : any,
  getSubAdapter?: getSubAdapterType,
  pluginManager?: PluginManager,
) => AnyDataAdapter

/**
 * An adapter class with its schema forgotten, which is what the registry holds
 * and `dataAdapterCache` constructs: the config node it has in hand came from
 * the `AdapterType` the same `type` name resolved to, and that lookup is the
 * only thing tying the two together.
 */
export type AnyAdapter = AdapterClassFor<any>
