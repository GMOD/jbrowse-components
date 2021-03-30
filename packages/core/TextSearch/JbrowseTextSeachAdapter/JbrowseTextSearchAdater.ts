import { searchType } from '../../data_adapters/BaseAdapter'
import * as data from './index/volvox/names/0.json'
// import * as things from './index/volvox/names/index'

export interface NameIndexEntry {
  // key: {prefix: Array(0), exact: Array(0)}
  [prefix: string]: Array<string>
  [exact: string]: Array<string>
}
export default class JbrowseTextSearchAdapter {
  /*
  Jbrowse1 text search adapter
  Allows search in Jbrowse 1 text index built by generate-names.pl
   */
  constructor() {
    //  read data from generate-names.pl
    this.name = 'Jbrowse1'
    this.index = data.default
  }

  private loadIndex() {
    // TODO: load index to search from
    console.log(data.default)
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
