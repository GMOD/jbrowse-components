import type { AnyDataAdapter } from './util.ts'
import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { getSubAdapterType } from '../dataAdapterCache.ts'

export * from './util.ts'
export * from './types.ts'
export { BaseAdapter } from './BaseAdapter.ts'
export { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter.ts'
export { BaseSequenceAdapter } from './BaseSequenceAdapter.ts'
export type { BaseTextSearchAdapter } from './BaseTextSearchAdapter.ts'
export type { BaseRefNameAliasAdapter } from './BaseRefNameAliasAdapter.ts'
export type { RegionsAdapter } from './RegionsAdapter.ts'

// see
// https://www.typescriptlang.org/docs/handbook/2/classes.html#abstract-construct-signatures
// for why this is the abstract construct signature
export type AnyAdapter = new (
  config: AnyConfigurationModel,
  getSubAdapter?: getSubAdapterType,
  pluginManager?: PluginManager,
) => AnyDataAdapter
