import { stringToJexlExpression } from '../../../util/jexlStrings.ts'
import { isFeature, jexlFeatureProxy } from '../../../util/simpleFeature.ts'

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
    jexl: JexlInstance
  }) {
    this.filterChain = filters
      .map(f => f.trim())
      .filter(f => !!f)
      .map(inputFilter => {
        const expr = stringToJexlExpression(inputFilter, jexl)
        return { expr, string: inputFilter }
      })
  }

  passes(...args: unknown[]) {
    const feature = isFeature(args[0]) ? jexlFeatureProxy(args[0]) : args[0]
    for (const entry of this.filterChain) {
      if (!entry.expr.eval({ feature })) {
        return false
      }
    }
    return true
  }

  toJSON() {
    return { filters: this.filterChain.map(f => f.string) }
  }

  static fromJSON(json: {
    filters: SerializedFilterChain
    jexl: JexlInstance
  }) {
    return new SerializableFilterChain(json)
  }
}
