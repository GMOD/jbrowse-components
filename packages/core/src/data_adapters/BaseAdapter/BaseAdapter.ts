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
   * Stashes the reference-sequence adapter config for adapters that decode
   * against the reference (e.g. BAM/CRAM). Set once and never cleared: the
   * adapter is cached per adapterConfig (dataAdapterCache), so a given instance
   * maps to a single, stable sequence adapter, and an `undefined` from a later
   * caller must not wipe a config an earlier one already primed. Callers don't
   * need to guard.
   */
  setSequenceAdapterConfig(config: Record<string, unknown> | undefined) {
    if (config) {
      this.sequenceAdapterConfig ??= config
    }
  }

  /** shorthand for `readConfObject(this.config, arg)` */
  getConf<
    SLOT extends
      | ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>
      | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>,
  >(
    arg: SLOT,
    args?: Record<string, unknown>,
  ): SLOT extends string
    ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONF>, SLOT>
    : any {
    return readConfObject(this.config, arg, args)
  }
}
