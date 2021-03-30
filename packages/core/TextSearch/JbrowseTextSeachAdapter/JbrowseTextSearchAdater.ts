import {
  searchType,
  BaseTextSearchAdapter,
} from '../../data_adapters/BaseAdapter'
import * as data from './index/volvox/names/0.json'
import MyConfigSchema from './configSchema'
import { readConfObject } from '../../configuration'
// import * as things from './index/volvox/names/index'

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
    this.index = data.default
    this.tracks = readConfObject(config, 'tracks')
  }

  private loadIndex() {
    // TODO: load index to search from
    // console.log(data.default)
    const nameKeys = Object.keys(this.index)
    const entries = new Map()
    nameKeys.forEach(nameKey => {
      entries.set(nameKey, this.index[nameKey])
    })
    return entries
  }

  searchIndex(input: string, type: searchType) {
    const entries = this.loadIndex()
    if (input) {
      console.log(input, type)
      console.log(entries.has(input))
      if (entries.has(input)) {
        return entries.get(input)[type]
      }
    }
    return []
  }

  public freeResources(/* { region } */) {}
}
