import { compilePredicates } from '../../../util/fieldPredicate.ts'
import { stringToJexlExpression } from '../../../util/jexlStrings.ts'
import { buildJexlContext } from '../../../util/simpleFeature.ts'

import type { FieldPredicate } from '../../../util/fieldPredicate.ts'
import type { JexlExpression, JexlInstance } from '../../../util/jexlStrings.ts'

interface Filter {
  string: string
  expr: JexlExpression
}

/**
 * A display's filter as it crosses to the worker: a `jexl:` expression that
 * must be truthy, or a field predicate (ADR-238), whose field is the
 * feature's own or a `jexl:` expression computed over it.
 */
export type SerializedFilterChain = (string | FieldPredicate)[]

interface Subject {
  feature: unknown
  extraContext: Record<string, unknown> | undefined
}

function fieldOf(feature: unknown, field: string) {
  return (feature as { get?: (name: string) => unknown }).get?.(field)
}

export default class SerializableFilterChain {
  filterChain: Filter[]

  readonly entries: SerializedFilterChain

  private readonly predicateTest: ((subject: Subject) => boolean) | undefined

  constructor({
    filters,
    jexl,
  }: {
    filters: SerializedFilterChain
    jexl: JexlInstance
  }) {
    this.entries = filters
    this.filterChain = filters
      .filter((f): f is string => typeof f === 'string')
      .map(f => f.trim())
      .filter(f => !!f)
      .map(inputFilter => {
        const expr = stringToJexlExpression(inputFilter, jexl)
        return { expr, string: inputFilter }
      })
    // one context per subject however many computed fields read it
    let contextOf: Subject | undefined
    let context: Record<string, unknown> | undefined
    const contextFor = (subject: Subject) => {
      if (contextOf !== subject) {
        contextOf = subject
        context = buildJexlContext({
          ...subject.extraContext,
          feature: subject.feature,
        })
      }
      return context
    }
    this.predicateTest = compilePredicates<Subject>(
      filters.filter((f): f is FieldPredicate => typeof f !== 'string'),
      field => {
        if (field.startsWith('jexl:')) {
          const expr = stringToJexlExpression(field, jexl)
          return {
            kind: 'get',
            get: subject => expr.eval(contextFor(subject)),
          }
        }
        return {
          kind: 'get',
          get: subject => fieldOf(subject.feature, field),
        }
      },
    )
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
    return this.predicateTest
      ? this.predicateTest({ feature, extraContext })
      : true
  }

  toJSON() {
    return { filters: this.entries }
  }

  static fromJSON(json: {
    filters: SerializedFilterChain
    jexl: JexlInstance
  }) {
    return new SerializableFilterChain(json)
  }
}
