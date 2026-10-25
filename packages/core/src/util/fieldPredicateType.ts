// Import-free, so a type-only module naming a filter step (`markEncodingTypes.ts`)
// does not carry `fieldPredicate.ts`'s runtime graph, and `jbrowse validate`
// can carry a copy (`scripts/generateMarkRules.ts`).

/**
 * Vega-Lite's field predicate (ADR-238): the `field` of each record and the
 * tests its value must pass, every one given. A value is missing as a color
 * key reads it (`isMissing`: absent, empty, or a VCF's `DP=.`), and
 * `valid: false` selects exactly those. A comparison reads the value as a
 * number (`numericValue`), so a missing value and text that is no number
 * both fail it.
 *
 * `compilePredicates` resolves each field once, before the loop, to a lane the
 * caller hands it, so the test it returns is a typed read and a compare per
 * record.
 *
 * Worked example: over a synteny payload whose `identity` lane is a
 * Float32Array, `[{ field: 'identity', gte: 0.9 }]` compiles to
 * `i => identity[i] >= Math.fround(0.9)`, NaN failing.
 */
export interface FieldPredicate {
  field: string
  equal?: string | number | boolean
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  oneOf?: readonly (string | number | boolean)[]
  valid?: boolean
}

/** Whether a predicate states any test, which an empty `{ field }` does not. */
export function testsSomething(p: FieldPredicate) {
  return (
    p.equal !== undefined ||
    p.lt !== undefined ||
    p.lte !== undefined ||
    p.gt !== undefined ||
    p.gte !== undefined ||
    p.oneOf !== undefined ||
    p.valid !== undefined
  )
}
