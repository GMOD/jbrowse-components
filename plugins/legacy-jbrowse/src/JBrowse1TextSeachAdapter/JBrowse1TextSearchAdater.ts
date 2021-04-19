import {
  searchType,
  BaseTextSearchAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { readConfObject } from '@jbrowse/core/configuration'
import { Option } from '@jbrowse/core/util/index'
import BaseResult, {
  LocationResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import MyConfigSchema from './configSchema'
import HttpMap from './HttpMap'

export default class JBrowse1TextSearchAdapter extends BaseTextSearchAdapter {
  /*
  Jbrowse1 text search adapter
  Uses index built by generate-names.pl
   */
  constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    this.tracks = readConfObject(config, 'tracks')
    this.assemblies = readConfObject(config, 'assemblies')
    this.namesDirPath = readConfObject(config, 'namesIndexDirLocation')
  }

  /**
   * Returns the contents of the file containing the query if it exists
   * else it returns empty
   * @param query - string query
   */
  async loadIndexFile(query: string) {
    // TODO: load index to search from
    // TODO: needs to handle different assemblies or organisms
    const httpMap = new HttpMap({
      url: '/test_data/volvox/names/',
      isElectron: false,
      browser: '',
    })

    const readyCheck = await httpMap.ready
    if (readyCheck) {
      const bucketContents = await httpMap.getBucket(query)
      return bucketContents
    }
    return {}
  }

  async searchIndex(input: string, type: searchType) {
    const entries = await this.loadIndexFile(input)
    if (entries && entries[input]) {
      return this.formatOptions(entries[input][type])
    }
    return []
  }

  formatOptions(results) {
    if (results.length === 0) {
      return []
    }
    const formattedOptions = results.map(result => {
      if (result && typeof result === 'object' && result.length > 1) {
        const name = result[0]
        const refName = result[3]
        const start = result[4]
        const end = result[5]
        const location = `${refName}:${start}-${end}`
        // const formattedResult: BaseResult = new LocationResult({
        //   refName,
        //   location,
        //   value: name,
        // })
        const formattedOption: Option = {
          group: 'text search adapter',
          value: name,
          location,
        }
        return formattedOption
      }
      const defaultOption: Option = {
        group: 'text search adapter',
        value: result,
      }
      return defaultOption
    })
    return formattedOptions
  }

  public freeResources(/* { region } */) {}
}
