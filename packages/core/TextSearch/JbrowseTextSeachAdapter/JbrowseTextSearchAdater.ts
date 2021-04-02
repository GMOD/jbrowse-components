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
export default class JbrowseTextSearchAdapter extends BaseTextSearchAdapter {
  /*
  Jbrowse1 text search adapter
  Allows search in Jbrowse 1 text index built by generate-names.pl
   */
  public constructor(config: Instance<typeof MyConfigSchema>) {
    //  read data from generate-names.pl
    super(config)
    this.name = 'test text search is connected'
  }

  private async loadIndex(query: string) {
    // TODO: load index to search from
    const httpMap = new HttpMap({
      url: '/test_data/volvox/names/',
      isElectron: false,
      browser: '',
    })
    const bucket=await httpMap.getBucket( query )
    console.log(bucket)
    const data = await fetch('/test_data/volvox/names/0.json').then(
      response => {
        return response.json()
      },
    )
    // console.log(data)
    const nameKeys = Object.keys(data)
    const entries = new Map()
    nameKeys.forEach(nameKey => {
      entries.set(nameKey, data[nameKey])
    })
    return entries
  }

  public async searchIndex(input: string, type: searchType) {
    const entries = await this.loadIndex(input)
    if (entries.get(input)) {
      return this.formatOptions(entries.get(input)[type])
    }
    return []
  }

  private formatOptions(results) {
    if (results.length === 0) {
      return []
    }
    const formattedOptions = results.map(result => {
      if (result && typeof result === 'object' && result.length > 1) {
        const val = result[0]
        const refName = result[3]
        const start = result[4]
        const end = result[5]
        const formattedResult: Option = {
          label: 'text search adapter',
          value: `${val} ${refName}:${start}-${end}`,
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
