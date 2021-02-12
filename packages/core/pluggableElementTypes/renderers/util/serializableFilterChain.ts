import { stringToJexlExpression } from '../../../util/jexlStrings'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterFunction = (...args: Record<string, any>[] | any[]) => boolean

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
        const func = stringToJexlExpression(inputFilter) as FilterFunction
        return { func, string: inputFilter }
      }
      throw new Error(`invalid inputFilter string "${inputFilter}"`)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  passes(...args: any[]) {
    for (let i = 0; i < this.filterChain.length; i += 1) {
      if (
        // @ts-ignore
        !this.filterChain[i].func.evalSync({ feature: args[0] })
      )
        return false
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
