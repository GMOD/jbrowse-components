import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'
import { getAdapterId } from './getAdapterId.ts'

import type PluginManager from '../../PluginManager.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotPath,
  ConfigurationSlotPathValue,
  ConfigurationSlotValue,
} from '../../configuration/index.ts'
import type { getSubAdapterType } from '../dataAdapterCache.ts'

const EmptyConfig = ConfigurationSchema('empty', {})

export class BaseAdapter<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> {
  id: string
  config: CONF
  getSubAdapter?: getSubAdapterType
  pluginManager?: PluginManager

  /**
   * The reference sequence this instance reads, as the adapter config of the
   * assembly the request that built it named. Part of the instance's identity:
   * dataAdapterCache keys a {@link READS_REFERENCE} adapter on its config AND
   * this, so one BAM shown on two genomes is two instances, each reading its
   * own. Undefined when the building request named no genome, and a reference
   * read then throws rather than guessing. Instance state rather than a
   * per-call argument because `CramAdapter` binds its reference fetch into the
   * `IndexedCramFile` at construction, inside @gmod/cram's slice cache.
   */
  readonly sequenceAdapterConfig?: Record<string, unknown>

  static capabilities: string[] = []

  constructor(
    config: CONF = EmptyConfig.create() as CONF,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
    sequenceAdapterConfig?: Record<string, unknown>,
  ) {
    this.config = config
    this.getSubAdapter = getSubAdapter
    this.pluginManager = pluginManager
    this.sequenceAdapterConfig = sequenceAdapterConfig
    this.id = getAdapterId(config)
  }

  /** shorthand for `readConfObject(this.config, arg)` */
  getConf<
    const SLOT extends
      | ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>
      | ConfigurationSlotPath<ConfigurationSchemaForModel<CONF>> =
      ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>,
  >(
    arg: SLOT,
    args?: Record<string, unknown>,
  ): SLOT extends string
    ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONF>, SLOT>
    : ConfigurationSlotPathValue<ConfigurationSchemaForModel<CONF>, SLOT> {
    return readConfObject(this.config, arg, args)
  }
}
