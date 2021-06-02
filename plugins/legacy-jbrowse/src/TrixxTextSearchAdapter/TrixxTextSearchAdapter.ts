/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult, {
  LocStringResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import { isElectron } from '@jbrowse/core/util'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import MyConfigSchema from './configSchema'

export default class TrixxTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter {
  /*
  Trixx text search adapter
   */

  tracksNames?: string[]

  constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const namesIndexLocation = readConfObject(config, 'namesIndexLocation')
    if (!namesIndexLocation) {
      throw new Error('must provide namesIndexLocation')
    }
  }

  /**
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...preffix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    return []
  }

  freeResources() {}
}
