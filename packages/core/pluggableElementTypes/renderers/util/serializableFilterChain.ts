import { stringToJexlExpression } from '../../../util/jexlStrings'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterExpression = (...args: Record<string, any>[] | any[]) => boolean

interface Filter {
  string: string
  expr: FilterExpression
}

export type SerializedFilterChain = string[]

export default class SerializableFilterChain {
  filterChain: Filter[]

  constructor({ filters = [] }: { filters: SerializedFilterChain }) {
    this.filterChain = filters.map(inputFilter => {
      if (typeof inputFilter === 'string') {
        const expr = stringToJexlExpression(inputFilter) as FilterExpression
        return { expr, string: inputFilter }
      }
      throw new Error(`invalid inputFilter string "${inputFilter}"`)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  passes(...args: any[]) {
    for (const entry of this.filterChain) {
      if (
        // @ts-expect-error
        !entry.expr.evalSync({ feature: args[0] })
      ) {
        return false
      }
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
