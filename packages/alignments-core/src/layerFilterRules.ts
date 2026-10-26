/**
 * The alignments layer filters' field rules, import-free so
 * `scripts/generateMarkRules.ts` can copy them into `jbrowse validate`. Each
 * check reads entries `predicatesOf` already normalized.
 */
export type LayerFilterTest =
  | 'equal'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'oneOf'
  | 'valid'

const TESTS: readonly LayerFilterTest[] = [
  'equal',
  'lt',
  'lte',
  'gt',
  'gte',
  'oneOf',
  'valid',
]

/** A layer filter entry: its field, and the tests it writes. */
export interface LayerFilterEntry extends Partial<
  Record<LayerFilterTest, unknown>
> {
  field: string
  gt?: number
  gte?: number
}

/** What a layer filter field takes: its tests, and the most a floor can be. */
export interface LayerFilterField {
  tests: readonly LayerFilterTest[]
  max?: number
}

/**
 * The entries of a layer's `filter` at `path` the layer cannot apply as
 * written: a field it has no reading of, a test the field does not take, or
 * a floor above the field's range.
 */
export function layerEntryProblems(
  path: string,
  entries: readonly LayerFilterEntry[],
  fields: Readonly<Record<string, LayerFilterField>>,
): string[] {
  return entries.flatMap(p => {
    const field = Object.hasOwn(fields, p.field) ? fields[p.field] : undefined
    if (!field) {
      return [
        `${path}: no field ${JSON.stringify(p.field)}; it takes ${Object.keys(fields).join(', ')}`,
      ]
    }
    const { tests, max } = field
    const refused = TESTS.filter(t => p[t] !== undefined && !tests.includes(t))
    return [
      ...(refused.length > 0
        ? [
            `${path}: ${p.field} takes ${tests.join(' or ')}, not ${JSON.stringify(p)}`,
          ]
        : []),
      ...(max !== undefined &&
      [p.gt, p.gte].some(b => b !== undefined && (b < 0 || b > max))
        ? [
            `${path}: ${p.field} runs from 0 to ${max}, not ${JSON.stringify(p)}`,
          ]
        : []),
    ]
  })
}

export const ALLELE_FRACTION = 'fraction'

/** The `coverage.alleles.filter` entries the band's draw cannot apply. */
export function alleleEntryProblems(entries: readonly LayerFilterEntry[]) {
  return layerEntryProblems('coverage.alleles.filter', entries, {
    [ALLELE_FRACTION]: { tests: ['gte'], max: 1 },
  })
}

/** The `coverage.interbase.filter` entries the triangle rule cannot apply. */
export function interbaseEntryProblems(entries: readonly LayerFilterEntry[]) {
  return layerEntryProblems('coverage.interbase.filter', entries, {
    depth: { tests: ['gte', 'gt'] },
    fraction: { tests: ['gte', 'gt'], max: 1 },
  })
}
