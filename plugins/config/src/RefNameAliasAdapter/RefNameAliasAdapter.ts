import {
  BaseRefNameAliasAdapter,
  Alias,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { GenericFilehandle } from 'generic-filehandle'
import { readConfObject } from '@jbrowse/core/configuration'

import { ConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import MyConfigAdapterSchema from './configSchema'

export default class RefNameAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter {
  private location: GenericFilehandle

  private promise: Promise<Alias[]>

  constructor(config: ConfigurationModel<typeof MyConfigAdapterSchema>) {
    super(config)
    this.location = openLocation(readConfObject(config, 'location'))
    this.promise = this.downloadResults()
  }

  private async downloadResults() {
    const results = (await this.location.readFile('utf8')) as string
    return results
      .trim()
      .split('\n')
      .map((row: string) => {
        const [refName, ...aliases] = row.split('\t')
        return { refName, aliases }
      })
  }

  getRefNameAliases() {
    return this.promise
  }

  async freeResources() {}
}
