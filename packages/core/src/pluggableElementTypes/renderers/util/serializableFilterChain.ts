import { stringToJexlExpression } from '../../../util/jexlStrings.ts'
import { buildJexlContext } from '../../../util/simpleFeature.ts'

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

  // `feature` is the filter subject; `extraContext` supplies any additional
  // named bindings the expression may reference. Both go through the same
  // context builder as config-slot evaluation, so a Feature is exposed
  // identically (proxy + `get()`), regardless of which path evaluates it.
  //
  // an empty chain skips context construction entirely: passes() runs once per
  // feature in the render admission path, and the unfiltered case would
  // otherwise allocate a spread, a context object, and a feature proxy per
  // feature only to admit it
  passes(feature: unknown, extraContext?: Record<string, unknown>) {
    if (this.filterChain.length > 0) {
      const context = buildJexlContext({ ...extraContext, feature })
      for (const entry of this.filterChain) {
        if (!entry.expr.eval(context)) {
          return false
        }
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
