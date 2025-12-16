import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema, readConfObject } from '../../configuration'
import idMaker from '../../util/idMaker'

import type PluginManager from '../../PluginManager'
import type { AnyConfigurationModel } from '../../configuration'
import type { AugmentedRegion as Region } from '../../util/types'
import type { getSubAdapterType } from '../dataAdapterCache'

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
    // note: we use switch on jest here for more simple feature IDs
    // in test environment
    if (typeof jest === 'undefined') {
      const data = isStateTreeNode(config) ? getSnapshot(config) : config
      this.id = `${idMaker(data)}`
    } else {
      this.id = 'test'
    }
  }

  /**
   * Sets the sequence adapter configuration for adapters that need reference
   * sequence data (e.g., CRAM adapters). Wrapper adapters like SNPCoverageAdapter
   * can override this to propagate to their subadapters.
   */
  setSequenceAdapterConfig(config: Record<string, unknown>) {
    this.sequenceAdapterConfig = config
  }

  /**
   * Same as `readConfObject(this.config, arg)`.
   * Note: Does not offer the same TS type checking as `readConfObject`,
   * consider using that instead.
   */
  getConf(arg: string | string[]) {
    return readConfObject(this.config, arg)
  }

  /**
   * Called to provide a hint that data tied to a certain region will not be
   * needed for the foreseeable future and can be purged from caches, etc
   * @param region - Region
   */
  freeResources(_region: Region) {}
}
