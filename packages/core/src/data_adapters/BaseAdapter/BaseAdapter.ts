import { getAdapterId } from './getAdapterId.ts'
import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'

import type PluginManager from '../../PluginManager.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
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

  sequenceAdapterConfig?: Record<string, unknown>

  static capabilities: string[] = []

  constructor(
    config: CONF = EmptyConfig.create() as CONF,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    this.config = config
    this.getSubAdapter = getSubAdapter
    this.pluginManager = pluginManager
    this.id = getAdapterId(config)
  }

  /**
   * Sets the sequence adapter configuration for adapters that need reference
   * sequence data (e.g., CRAM adapters). Wrapper adapters like
   * SNPCoverageAdapter can override this to propagate to their subadapters.
   *
   * No-op if a sequence adapter config is already set or the argument is
   * undefined, so callers don't need to guard.
   */
  setSequenceAdapterConfig(config: Record<string, unknown> | undefined) {
    if (config && !this.sequenceAdapterConfig) {
      this.sequenceAdapterConfig = config
    }
  }

  /** shorthand for `readConfObject(this.config, arg)` */
  getConf<
    SLOT extends
      ConfigurationSlotName<ConfigurationSchemaForModel<CONF>> | string[] =
      ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>,
  >(
    arg: SLOT,
    args?: Record<string, unknown>,
  ): SLOT extends string
    ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONF>, SLOT>
    : any {
    return readConfObject(this.config, arg, args)
  }
}
