import { stringToJexlExpression } from '../../../util/jexlStrings.ts'

import type { JexlExpression, JexlInstance } from '../../../util/jexlStrings.ts'

interface Filter {
  string: string
  expr: JexlExpression
}

export type SerializedFilterChain = string[]

export default class SerializableFilterChain {
  filterChain: Filter[]

  constructor({
    filters,
    jexl,
  }: {
    filters: SerializedFilterChain
    jexl?: JexlInstance
  }) {
    this.filterChain = filters
      .map(f => f.trim())
      .filter(f => !!f)
      .map(inputFilter => {
        if (typeof inputFilter === 'string') {
          const expr = stringToJexlExpression(inputFilter, jexl)
          return { expr, string: inputFilter }
        }
        throw new Error(`invalid inputFilter string "${inputFilter}"`)
      })
  }

  passes(...args: unknown[]) {
    for (const entry of this.filterChain) {
      if (!entry.expr.eval({ feature: args[0] })) {
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
