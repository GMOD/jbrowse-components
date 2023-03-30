import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'

// locals
import { readConfObject, AnyConfigurationModel } from '../../configuration'
import { getSubAdapterType } from '../dataAdapterCache'
import { AugmentedRegion as Region } from '../../util/types'
import idMaker from '../../util/idMaker'
import PluginManager from '../../PluginManager'
import { ConfigurationSchema } from '../../configuration'

const EmptyConfig = ConfigurationSchema('empty', {})

export abstract class BaseAdapter {
  public id: string

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

  getConf(arg: string | string[]) {
    return readConfObject(this.config, arg)
  }

  /**
   * Called to provide a hint that data tied to a certain region will not be
   * needed for the foreseeable future and can be purged from caches, etc
   * @param region - Region
   */
  public abstract freeResources(region: Region): void
}
