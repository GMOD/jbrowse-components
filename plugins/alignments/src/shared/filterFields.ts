import {
  JUNCTION_CLASSES,
  JUNCTION_SOURCES,
  samFlagNames,
  testsSomething,
} from './filterRuleFacts.ts'

import type { FieldPredicate } from './filterRuleFacts.ts'

/** The prefix a `field` takes to name a read tag: `tags.HP`. */
export const TAG_FIELD_PREFIX = 'tags.'

/**
 * The tag a field names, or undefined for any other field: one reading for
 * `encoding.color`, `facet`, `sort` and `filter` alike. Their named fields
 * stay apart (`COLOR_FIELDS`, `READ_DIMENSIONS`, `COLUMN_SORT_FIELDS`, the
 * filter's record fields), since each channel answers a different set.
 */
export function fieldTag(field: string | undefined) {
  return field?.startsWith(TAG_FIELD_PREFIX)
    ? field.slice(TAG_FIELD_PREFIX.length)
    : undefined
}

export const FLAG_FIELD_PREFIX = 'flags.'

/** A SAM flag bit as a field: `flags.UNMAP`, `flags.DUP`, samtools' names. */
export const FLAG_FIELDS: readonly string[] = samFlagNames.map(
  name => `${FLAG_FIELD_PREFIX}${name}`,
)

const RECORD_FIELDS = new Set(['name', 'spliced', ...FLAG_FIELDS])
export const CHAIN_FIELDS = new Set(['svSignal', 'alone', 'split'])
export const MAPQ_FIELD = 'mapq'

export const JUNCTION_READS = 'junction.reads'
export const JUNCTION_CANONICAL = 'junction.canonical'
export const JUNCTION_CLASS = 'junction.class'
export const JUNCTION_SOURCE = 'junction.source'
export const CONNECTION_INTERCHROM = 'connection.interchrom'
export const CONNECTION_OFFSCREEN = 'connection.offscreen'
export const BREAKPOINT_READS = 'breakpoint.reads'

// The fields lowered onto the junction and connection tests, each with the
// tests it takes: a count takes a floor, a category a boolean `equal`.
const COUNT_FIELDS = new Set([JUNCTION_READS, BREAKPOINT_READS])
const ROW_CATEGORY_FIELDS = new Set([
  JUNCTION_CANONICAL,
  CONNECTION_INTERCHROM,
  CONNECTION_OFFSCREEN,
])
// and a closed vocabulary its values, by `equal` or `oneOf`
const ROW_VALUE_FIELDS = new Map<string, readonly string[]>([
  [JUNCTION_CLASS, JUNCTION_CLASSES],
  [JUNCTION_SOURCE, JUNCTION_SOURCES],
])

export function isRecordField(field: string) {
  return RECORD_FIELDS.has(field) || fieldTag(field) !== undefined
}

/** Whether the worker reads `field`, so a read filter edit refetches. */
export function isReadField(field: string) {
  return isRecordField(field) || field === MAPQ_FIELD || CHAIN_FIELDS.has(field)
}

/**
 * Entries the display cannot apply as written: a field it has no reading of,
 * or a test its junction and connection fields do not take.
 */
export function filterProblems(written: readonly FieldPredicate[]): string[] {
  return written.flatMap(p => {
    const { field } = p
    if (COUNT_FIELDS.has(field)) {
      return p.lt !== undefined ||
        p.lte !== undefined ||
        p.equal !== undefined ||
        p.oneOf !== undefined ||
        p.valid !== undefined
        ? [`${field} takes a floor (gte or gt), not ${JSON.stringify(p)}`]
        : []
    }
    if (ROW_CATEGORY_FIELDS.has(field)) {
      return testsSomething(p) && typeof p.equal !== 'boolean'
        ? [`${field} takes equal: true or false, not ${JSON.stringify(p)}`]
        : []
    }
    const vocabulary = ROW_VALUE_FIELDS.get(field)
    if (vocabulary) {
      const values = [
        ...(p.equal === undefined ? [] : [p.equal]),
        ...(p.oneOf ?? []),
      ]
      return p.lt !== undefined ||
        p.lte !== undefined ||
        p.gt !== undefined ||
        p.gte !== undefined ||
        p.valid !== undefined ||
        values.some(v => typeof v !== 'string' || !vocabulary.includes(v))
        ? [
            `${field} takes equal or oneOf of ${vocabulary.join(', ')}, not ${JSON.stringify(p)}`,
          ]
        : []
    }
    return isReadField(field)
      ? []
      : [`no field ${JSON.stringify(field)} on an alignment`]
  })
}
