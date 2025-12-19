import type { AnyDataAdapter } from './util'
import type PluginManager from '../../PluginManager'
import type { AnyConfigurationModel } from '../../configuration'
import type { getSubAdapterType } from '../dataAdapterCache'

export * from './util'
export * from './types'
export { BaseAdapter } from './BaseAdapter'
export { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter'
export { BaseSequenceAdapter } from './BaseSequenceAdapter'
export type { BaseTextSearchAdapter } from './BaseTextSearchAdapter'
export type { BaseRefNameAliasAdapter } from './BaseRefNameAliasAdapter'
export type { RegionsAdapter } from './RegionsAdapter'

// see
// https://www.typescriptlang.org/docs/handbook/2/classes.html#abstract-construct-signatures
// for why this is the abstract construct signature
export type AnyAdapter = new (
  config: AnyConfigurationModel,
  getSubAdapter?: getSubAdapterType,
  pluginManager?: PluginManager,
) => AnyDataAdapter
