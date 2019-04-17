import { stringToFunction } from '@gmod/jbrowse-core/util/functionStrings'

export default class SerializableFilterChain {
  constructor({ filters = [] }) {
    this.filterChain = filters.map(inputFilter => {
      if (typeof inputFilter === 'string') {
        const func = stringToFunction(inputFilter)
        return { func, string: inputFilter }
      }
      throw new Error(`invalid inputFilter string "${inputFilter}"`)
    })
  }

  passes(...args) {
    for (let i = 0; i < this.filterChain.length; i += 1) {
      if (!this.filterChain[i].func.apply(this, args)) return false
    }
    return true
  }

  toJSON() {
    return { filters: this.filterChain.map(f => f.string) }
  }

  static fromJSON(json) {
    return new SerializableFilterChain(json)
  }
}
