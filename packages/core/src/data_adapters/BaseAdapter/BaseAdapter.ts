import { getAdapterId } from './getAdapterId.ts'
import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { getSubAdapterType } from '../dataAdapterCache.ts'

const EmptyConfig = ConfigurationSchema('empty', {})

export class BaseAdapter {
  public id: string

  public sequenceAdapterConfig?: Record<string, unknown>

  static capabilities = [] as string[]

  constructor(
    public config: AnyConfigurationModel = EmptyConfig.create(),
    public getSubAdapter?: getSubAdapterType,
    public pluginManager?: PluginManager,
  ) {
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
  getConf(arg: string | string[]) {
    return readConfObject(this.config, arg)
  }
}
