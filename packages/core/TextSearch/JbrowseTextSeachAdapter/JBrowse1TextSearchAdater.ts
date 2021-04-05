import {
  searchType,
  BaseTextSearchAdapter,
} from '../../data_adapters/BaseAdapter'
import MyConfigSchema from './configSchema'
import HttpMap from './HttpMap'

export interface NameIndexEntry {
  // key: {prefix: Array(0), exact: Array(0)}
  [prefix: string]: Array<string>
  [exact: string]: Array<string>
}

export interface Option {
  label: string
  value: string
  inputValue?: string
}
export default class JBrowse1TextSearchAdapter extends BaseTextSearchAdapter {
  /*
  Jbrowse1 text search adapter
  Uses index built by generate-names.pl
   */
  constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    this.name = 'test text search is connected'
  }

  async loadIndex(query: string) {
    // TODO: load index to search from
    const httpMap = new HttpMap({
      url: '/test_data/volvox/names/',
      isElectron: false,
      browser: '',
    })

    const readyCheck = await httpMap.ready
    if (readyCheck) {
      console.log('bucket content for: ', query, await httpMap.getBucket(query))
    }
    return {}
  }

  async searchIndex(input: string, type: searchType) {
    const entries = await this.loadIndex(input)
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
        const formattedResult: Option = {
          label: 'text search adapter',
          value: `${name} ${refName}:${start}-${end}`,
          inputValue: `${refName}:${start}-${end}`,
        }
        return formattedResult
      }
      const defaultOption: Option = {
        label: 'text search adapter',
        value: result,
      }
      return defaultOption
    })
    return formattedOptions
  }

  public freeResources(/* { region } */) {}
}
