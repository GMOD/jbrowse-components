import { stringToFunction } from '../../../util/functionStrings'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterFunction = (...args: any[]) => boolean

interface Filter {
  string: string
  func: FilterFunction
}

export type SerializedFilterChain = string[]

export default class SerializableFilterChain {
  filterChain: Filter[]

  constructor({ filters = [] }: { filters: SerializedFilterChain }) {
    this.filterChain = filters.map(inputFilter => {
      if (typeof inputFilter === 'string') {
        const func = stringToFunction(inputFilter) as FilterFunction
        return { func, string: inputFilter }
      }
      throw new Error(`invalid inputFilter string "${inputFilter}"`)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  passes(...args: any[]) {
    for (let i = 0; i < this.filterChain.length; i += 1) {
      if (!this.filterChain[i].func.apply(this, args)) return false
    }
    return true
  }

  toJSON() {
    return { filters: this.filterChain.map(f => f.string) }
  }

  static fromJSON(json: { filters: SerializedFilterChain }) {
    return new SerializableFilterChain(json)
  }
}
