import { element } from 'prop-types'

export default class JbrowseTextSearchAdapter {
  /*
  Jbrowse1 text search adapter
  Allows search in Jbrowse 1 text index made by generate-names.pl
   */
  constructor() {
    this.name = 'Jbrowse1'
    this.names = ['ctgA', 'ctgB']
    this.data = [
      { type: 'text search adapter', value: 'ctgA', start: 1, end: 1000 },
      { type: 'text search adapter', value: 'ctgB', start: 1, end: 500 },
    ]
  }

  search(input: string) {
    if (input) {
      return this.data.filter(elem => {
        return elem.value.includes(input)
      })
    }
    return []
  }
}
