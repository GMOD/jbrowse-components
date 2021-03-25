export default class JbrowseTextSearchAdapter {
  constructor() {
    this.name = 'test'
  }

  search(input: string) {
    if (input === 'hello') {
      return [
        { test: input, elem: 'hello', refName: 'ctgA', start: 1, end: 1000 },
      ]
    }
    return []
  }
}
