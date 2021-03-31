import {
  searchType,
  BaseTextSearchAdapter,
} from '../../data_adapters/BaseAdapter'
import MyConfigSchema from './configSchema'

export interface NameIndexEntry {
  // key: {prefix: Array(0), exact: Array(0)}
  [prefix: string]: Array<string>
  [exact: string]: Array<string>
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

  private async loadIndex() {
    // TODO: load index to search from
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
    const entries = await this.loadIndex()
    if (entries.get(input)) {
      // console.log(input, type)
      // console.log('results', entries.get(input)[type])
      return entries.get(input)[type]
    }
    return []
  }

  public freeResources(/* { region } */) {}
}
