import {
  JUNCTION_CLASSES,
  JUNCTION_SOURCES,
  samFlagNames,
  testsSomething,
} from './filterRuleFacts.ts'
import { DIMENSION_LEVELS, READ_DIMENSIONS } from './readFieldLevels.ts'

import type { FieldPredicate } from './filterRuleFacts.ts'

/** The prefix a `field` takes to name a read tag: `tags.HP`. */
export const TAG_FIELD_PREFIX = 'tags.'

/**
 * The tag a field names, or undefined for any other field: one reading for
 * `encoding.color`, `facet`, `sort` and `filter` alike. Their named fields
 * stay apart (`COLOR_FIELDS`, `READ_DIMENSIONS`, `COLUMN_SORT_FIELDS`, the
 * filter's record fields), since each channel answers a different set; the
 * filter takes the read dimensions too (`DIMENSION_FIELDS`).
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

// Which reads count: the adapters drop by flag and tag as they parse, the
// worker by `mapq` once the fetch is deduped, and coverage counts the rest.
const ADAPTER_FLAG_FIELDS = new Set(FLAG_FIELDS)
export const MAPQ_FIELD = 'mapq'

// Which counted reads are drawn, leaving coverage whole: `name` and `spliced`
// test each record, the rest its chain.
export const DRAWN_RECORD_FIELDS = new Set(['name', 'spliced'])
export const CHAIN_FIELDS = new Set(['svSignal', 'alone', 'split'])

export const JUNCTION_READS = 'junction.reads'
export const JUNCTION_CANONICAL = 'junction.canonical'
export const JUNCTION_CLASS = 'junction.class'
export const JUNCTION_SOURCE = 'junction.source'
export const CONNECTION_INTERCHROM = 'connection.interchrom'
export const CONNECTION_OFFSCREEN = 'connection.offscreen'
export const BREAKPOINT_READS = 'breakpoint.reads'

// The fields lowered onto the junction and connection tests, each with the
// tests it takes: a count takes a floor, a category a boolean `equal`, as
// the read categories do.
const COUNT_FIELDS = new Set([JUNCTION_READS, BREAKPOINT_READS])
const CATEGORY_FIELDS = new Set([
  JUNCTION_CANONICAL,
  CONNECTION_INTERCHROM,
  CONNECTION_OFFSCREEN,
  'spliced',
  ...CHAIN_FIELDS,
])
// and a closed vocabulary its values, by `equal` or `oneOf`
const ROW_VALUE_FIELDS = new Map<string, readonly string[]>([
  [JUNCTION_CLASS, JUNCTION_CLASSES],
  [JUNCTION_SOURCE, JUNCTION_SOURCES],
])

export function isAdapterField(field: string) {
  return ADAPTER_FLAG_FIELDS.has(field) || fieldTag(field) !== undefined
}

/**
 * The read dimensions the filter has no reading of, each with the field
 * asking the same question: a read's strand is SAM flag 0x10, which the
 * adapters test and coverage counts by.
 */
export const RESPELLED_FIELDS: ReadonlyMap<string, string> = new Map([
  ['strand', 'flags.REVERSE'],
])

function hasOwnReading(field: string) {
  return (
    isAdapterField(field) ||
    field === MAPQ_FIELD ||
    DRAWN_RECORD_FIELDS.has(field) ||
    CHAIN_FIELDS.has(field)
  )
}

/**
 * The read dimensions the filter tests by a facet's keys, each read by its
 * own key as a facet by read files it (`svKind` by its chain's), picking
 * which counted reads are drawn: every one the filter neither reads its own
 * way (`split`, `spliced`, `mapq`) nor respells.
 */
export const DIMENSION_FIELDS: ReadonlySet<string> = new Set(
  READ_DIMENSIONS.filter(d => !hasOwnReading(d) && !RESPELLED_FIELDS.has(d)),
)

/** Whether `field` picks which counted reads are drawn. */
export function isDrawnField(field: string) {
  return (
    DRAWN_RECORD_FIELDS.has(field) ||
    CHAIN_FIELDS.has(field) ||
    DIMENSION_FIELDS.has(field)
  )
}

/** Whether the worker reads `field`, so a read filter edit refetches. */
export function isReadField(field: string) {
  return isAdapterField(field) || field === MAPQ_FIELD || isDrawnField(field)
}

function testsBound(p: FieldPredicate) {
  return (
    p.lt !== undefined ||
    p.lte !== undefined ||
    p.gt !== undefined ||
    p.gte !== undefined
  )
}

function listedValues(p: FieldPredicate) {
  return [...(p.equal === undefined ? [] : [p.equal]), ...(p.oneOf ?? [])]
}

// A read dimension takes its values by `equal` or `oneOf`, a closed one only
// its levels, and `valid: false` for the reads with none
function dimensionProblems(p: FieldPredicate) {
  const levels = DIMENSION_LEVELS[p.field]
  return testsBound(p) ||
    (levels && listedValues(p).some(v => !levels.includes(String(v))))
    ? [
        `${p.field} takes equal or oneOf${levels ? ` of ${levels.join(', ')}` : ''}, or valid, not ${JSON.stringify(p)}`,
      ]
    : []
}

/**
 * Entries the display cannot apply as written: a field it has no reading of,
 * or a test its junction, connection and read dimension fields do not take.
 */
export function filterProblems(written: readonly FieldPredicate[]): string[] {
  return written.flatMap(p => {
    const { field } = p
    const respelled = RESPELLED_FIELDS.get(field)
    if (respelled !== undefined) {
      return [
        `no field ${JSON.stringify(field)} to filter by; ${respelled} asks the same`,
      ]
    }
    if (DIMENSION_FIELDS.has(field)) {
      return dimensionProblems(p)
    }
    if (COUNT_FIELDS.has(field)) {
      return p.lt !== undefined ||
        p.lte !== undefined ||
        p.equal !== undefined ||
        p.oneOf !== undefined ||
        p.valid !== undefined
        ? [`${field} takes a floor (gte or gt), not ${JSON.stringify(p)}`]
        : []
    }
    if (CATEGORY_FIELDS.has(field)) {
      return testsSomething(p) && typeof p.equal !== 'boolean'
        ? [`${field} takes equal: true or false, not ${JSON.stringify(p)}`]
        : []
    }
    const vocabulary = ROW_VALUE_FIELDS.get(field)
    if (vocabulary) {
      return testsBound(p) ||
        p.valid !== undefined ||
        listedValues(p).some(
          v => typeof v !== 'string' || !vocabulary.includes(v),
        )
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
