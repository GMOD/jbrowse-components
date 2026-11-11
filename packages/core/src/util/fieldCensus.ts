import { valueText } from './groupKeys.ts'

import type { Feature } from './simpleFeature.ts'

// Where a feature sits and what it is made of, never a value it carries: a
// BED12 row's block and thick columns are its geometry, which its children
// and its drawing already state.
const STRUCTURE_FIELDS = new Set([
  'uniqueId',
  'refName',
  'start',
  'end',
  'subfeatures',
  'parentId',
  'blockCount',
  'blockSizes',
  'blockStarts',
  'chromStarts',
  'thickStart',
  'thickEnd',
])

// Text past which a value is prose or a payload, never a category.
const LONG_TEXT = 256

const MARKUP = /<[a-z/!][^>]*>|&(?:#\d+|#x[\da-f]+|[a-z]+);/i

function isJson(text: string) {
  try {
    return typeof JSON.parse(text) === 'object'
  } catch {
    return false
  }
}

/**
 * Whether a text value is a blob a picker should not offer as a field: HTML
 * (a bigBed's `_mouseOver`, a ClinVar `reviewStatus` of `&#9733;` stars), a
 * JSON payload, or text long enough to be prose.
 */
export function isBlobText(text: string) {
  const trimmed = text.trim()
  return (
    trimmed.length > LONG_TEXT ||
    MARKUP.test(trimmed) ||
    (/^[[{]/.test(trimmed) && /[\]}]$/.test(trimmed) && isJson(trimmed))
  )
}

/** What a set of features holds in one field. */
export interface FieldSummary {
  /**
   * The field as a channel reads it: a name, or the dotted path one level
   * into a structured field (`INFO.DP` on a VCF record, `tags.NM` on a read).
   */
  field: string
  /** How many of the features carry a value. */
  carried: number
  /**
   * Whether every single value read as a finite number. A list of several is
   * judged by none of them, so one multi-allelic site leaves `INFO.AF`
   * numeric; undefined where the field holds such lists alone, which no
   * channel reads as one datum.
   */
  numeric: boolean | undefined
  /**
   * The distinct values as `valueText` reads them, a list joined, in the
   * order first seen; undefined once there are more than the cap.
   */
  values: string[] | undefined
}

/** The fields a set of features carry, and how many features that was. */
export interface FieldCensus {
  n: number
  fields: FieldSummary[]
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// A record's own fields, and one level into a structured one.
function leafEntries(record: Record<string, unknown>): [string, unknown][] {
  return Object.entries(record).flatMap(([field, value]) =>
    STRUCTURE_FIELDS.has(field)
      ? []
      : isRecord(value)
        ? Object.entries(value).map(([key, member]): [string, unknown] => [
            `${field}.${key}`,
            member,
          ])
        : [[field, value]],
  )
}

function holdsRecord(value: unknown) {
  return Array.isArray(value) ? value.some(isRecord) : isRecord(value)
}

// One datum: a one-element list is its element, as a VCF INFO value is.
function singleOf(value: unknown) {
  const list: readonly unknown[] | undefined = Array.isArray(value)
    ? value
    : undefined
  return list === undefined ? value : list.length === 1 ? list[0] : undefined
}

function isNumericDatum(v: unknown) {
  return typeof v === 'number'
    ? Number.isFinite(v)
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
}

interface Tally {
  carried: number
  numeric: boolean | undefined
  values: Set<string> | undefined
  blob: boolean
}

/**
 * One walk over a set of features answering what every field picker asks:
 * which fields they carry, how many carry each, whether it is a number, and
 * its distinct values while there are no more than `cap`. A color key, a
 * section list and a row axis each read their own rule off the summaries.
 * A BED12 row's geometry and a field holding any blob (`isBlobText`) are no
 * field a picker offers, so neither is listed.
 *
 * The names come from `feature.toJSON()`, the only field list `Feature`
 * offers, and on a gene that serializes the transcript tree as well: nine
 * tenths of the ~16µs an NCBI-shaped gene costs here. Anything running this
 * per fetch needs a cheaper enumeration than the interface has today.
 */
export function censusFields(
  features: Iterable<Feature>,
  cap: number,
): FieldCensus {
  const tallies = new Map<string, Tally>()
  let n = 0
  for (const feature of features) {
    n++
    for (const [field, value] of leafEntries(feature.toJSON())) {
      const text = holdsRecord(value) ? '' : valueText(value)
      if (text !== '') {
        const tally = tallies.get(field) ?? {
          carried: 0,
          numeric: undefined,
          values: new Set<string>(),
          blob: false,
        }
        tallies.set(field, tally)
        tally.carried++
        tally.blob ||= isBlobText(text)
        const single = singleOf(value)
        if (single !== undefined) {
          tally.numeric = (tally.numeric ?? true) && isNumericDatum(single)
        }
        tally.values?.add(text)
        if (tally.values && tally.values.size > cap) {
          tally.values = undefined
        }
      }
    }
  }
  return {
    n,
    fields: [...tallies].flatMap(
      ([field, { carried, numeric, values, blob }]) =>
        blob
          ? []
          : [{ field, carried, numeric, values: values && [...values] }],
    ),
  }
}
