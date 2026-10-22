import { CIGAR_HAS_SKIP, samFlagNames } from '@jbrowse/cigar-utils'
import {
  compilePredicates,
  testsSomething,
} from '@jbrowse/core/util/fieldPredicate'

import { TAG_FIELD_PREFIX } from './facetLabels.ts'

import type {
  CategoryFilter,
  ConnectionFilter,
  JunctionFilter,
  TagFilter,
} from './types.ts'
import type {
  FieldPredicate,
  PredicateLane,
} from '@jbrowse/core/util/fieldPredicate'

/**
 * The alignments display's `filter` (ADR-240): one predicate list, read where
 * each field can be answered. The adapters answer a record's own fields as
 * they parse it, the worker the mapping quality once the fetch is deduped and
 * the read categories once reads are grouped into chains, and the main thread
 * the splice junctions and the connections between reads.
 */

export const FLAG_FIELD_PREFIX = 'flags.'

/** A SAM flag bit as a field: `flags.UNMAP`, `flags.DUP`, samtools' names. */
export const FLAG_FIELDS: readonly string[] = samFlagNames.map(
  name => `${FLAG_FIELD_PREFIX}${name}`,
)

const RECORD_FIELDS = new Set(['name', 'spliced', ...FLAG_FIELDS])
const CHAIN_FIELDS = new Set(['svSignal', 'alone', 'split'])
const MAPQ_FIELD = 'mapq'

const JUNCTION_READS = 'junction.reads'
const JUNCTION_CANONICAL = 'junction.canonical'
const CONNECTION_INTERCHROM = 'connection.interchrom'
const CONNECTION_OFFSCREEN = 'connection.offscreen'
const BREAKPOINT_READS = 'breakpoint.reads'

// The fields lowered onto the junction and connection tests, each with the
// tests it takes: a count takes a floor, a category a boolean `equal`.
const COUNT_FIELDS = new Set([JUNCTION_READS, BREAKPOINT_READS])
const ROW_CATEGORY_FIELDS = new Set([
  JUNCTION_CANONICAL,
  CONNECTION_INTERCHROM,
  CONNECTION_OFFSCREEN,
])

function isTagField(field: string) {
  return field.startsWith(TAG_FIELD_PREFIX)
}

function isRecordField(field: string) {
  return RECORD_FIELDS.has(field) || isTagField(field)
}

/** Whether the worker reads `field`, so a read filter edit refetches. */
export function isReadField(field: string) {
  return isRecordField(field) || field === MAPQ_FIELD || CHAIN_FIELDS.has(field)
}

/**
 * What applies with nothing written: unmapped, QC-failed and duplicate reads
 * out (samtools' 1540), and a floor of two reads under a splice junction and
 * under an inter-chromosomal breakpoint.
 */
export const ALIGNMENTS_FILTER_DEFAULTS: readonly FieldPredicate[] = [
  { field: 'flags.UNMAP', equal: false },
  { field: 'flags.QCFAIL', equal: false },
  { field: 'flags.DUP', equal: false },
  { field: JUNCTION_READS, gte: 2 },
  { field: BREAKPOINT_READS, gte: 2 },
]

/**
 * A written list over the defaults, by field (ADR-240 amendment 1): an entry
 * replaces the defaults on its own field, every entry written on one field
 * applies, and an entry naming a field with no test only removes that field's
 * defaults.
 */
export function mergeFilter(
  written: readonly FieldPredicate[],
  defaults: readonly FieldPredicate[] = ALIGNMENTS_FILTER_DEFAULTS,
): FieldPredicate[] {
  const named = new Set(written.map(p => p.field))
  return [
    ...defaults.filter(p => !named.has(p.field)),
    ...written.filter(testsSomething),
  ]
}

/** The entries on `field`, in list order. */
export function entriesOn(
  predicates: readonly FieldPredicate[],
  field: string,
): FieldPredicate[] {
  return predicates.filter(p => p.field === field)
}

function sameEntries(
  a: readonly FieldPredicate[],
  b: readonly FieldPredicate[],
) {
  return (
    a.length === b.length &&
    a.every((p, i) => JSON.stringify(p) === JSON.stringify(b[i]))
  )
}

/**
 * The written list with `field`'s entries replaced: `undefined` returns the
 * field to its defaults, and an empty list clears it, which over a field with
 * defaults writes the bare `{ field }` that removes them. Entries equal to the
 * defaults are left unwritten. Every other field keeps what was written.
 */
export function withField(
  written: readonly FieldPredicate[],
  field: string,
  entries: readonly FieldPredicate[] | undefined,
  defaults: readonly FieldPredicate[] = ALIGNMENTS_FILTER_DEFAULTS,
): FieldPredicate[] {
  const fieldDefaults = entriesOn(defaults, field)
  const next =
    entries === undefined || sameEntries(entries, fieldDefaults)
      ? []
      : entries.length === 0
        ? fieldDefaults.length > 0
          ? [{ field }]
          : []
        : entries
  const at = written.findIndex(p => p.field === field)
  const rest = written.filter(p => p.field !== field)
  return at === -1
    ? [...rest, ...next]
    : [...rest.slice(0, at), ...next, ...rest.slice(at)]
}

/** `withField` over several fields at once. */
export function withFields(
  written: readonly FieldPredicate[],
  patch: Readonly<Record<string, readonly FieldPredicate[] | undefined>>,
  defaults: readonly FieldPredicate[] = ALIGNMENTS_FILTER_DEFAULTS,
): FieldPredicate[] {
  let next = [...written]
  for (const [field, entries] of Object.entries(patch)) {
    next = withField(next, field, entries, defaults)
  }
  return next
}

/** The read fields alone, which is what the worker is handed. */
export function readPredicatesOf(predicates: readonly FieldPredicate[]) {
  return predicates.filter(p => isReadField(p.field))
}

// ---- categories: a boolean field tested `equal: true` or `equal: false` ----

/**
 * A boolean field's entries as the three-way menu reads them: `only` for
 * `equal: true`, `exclude` for `equal: false`, unset otherwise.
 */
export function categoryOf(
  predicates: readonly FieldPredicate[],
  field: string,
): CategoryFilter | undefined {
  const equal = entriesOn(predicates, field).find(
    p => typeof p.equal === 'boolean',
  )?.equal
  return equal === true ? 'only' : equal === false ? 'exclude' : undefined
}

/** The entries a category radio writes on `field`. */
export function categoryEntries(
  field: string,
  value: CategoryFilter | undefined,
): FieldPredicate[] {
  return value === undefined ? [] : [{ field, equal: value === 'only' }]
}

// ---- counts: an integer floor ----

// `gt: n` on a count is `gte: n + 1`.
function countFloorOf(predicates: readonly FieldPredicate[], field: string) {
  let floor: number | undefined
  for (const p of entriesOn(predicates, field)) {
    for (const bound of [p.gte, p.gt === undefined ? undefined : p.gt + 1]) {
      if (bound !== undefined && (floor === undefined || bound > floor)) {
        floor = bound
      }
    }
  }
  return floor
}

/** The entries a floor of `min` writes on a count field, none for 1 or less. */
export function floorEntries(field: string, min: number): FieldPredicate[] {
  return min > 1 ? [{ field, gte: min }] : []
}

// ---- the main thread's rows ----

/** The splice junctions drawn, as the sashimi and tables code test them. */
export function junctionFilterOf(
  predicates: readonly FieldPredicate[],
): JunctionFilter {
  const canonical = categoryOf(predicates, JUNCTION_CANONICAL)
  return {
    minReads: countFloorOf(predicates, JUNCTION_READS) ?? 1,
    nonCanonical:
      canonical === 'only'
        ? 'exclude'
        : canonical === 'exclude'
          ? 'only'
          : undefined,
  }
}

/** `junctionFilterOf`'s two members as the entries they are. */
export function junctionEntries(
  patch: Partial<JunctionFilter>,
): Record<string, FieldPredicate[]> {
  return {
    ...(patch.minReads === undefined
      ? {}
      : { [JUNCTION_READS]: floorEntries(JUNCTION_READS, patch.minReads) }),
    ...('nonCanonical' in patch
      ? {
          [JUNCTION_CANONICAL]: categoryEntries(
            JUNCTION_CANONICAL,
            patch.nonCanonical === 'only'
              ? 'exclude'
              : patch.nonCanonical === 'exclude'
                ? 'only'
                : undefined,
          ),
        }
      : {}),
  }
}

/** The connections drawn, as the arcs, cloud and connectors test them. */
export function connectionFilterOf(
  predicates: readonly FieldPredicate[],
): ConnectionFilter {
  return {
    interchrom: categoryOf(predicates, CONNECTION_INTERCHROM),
    offscreenMates: categoryOf(predicates, CONNECTION_OFFSCREEN),
    minInterchromReads: countFloorOf(predicates, BREAKPOINT_READS) ?? 1,
  }
}

/** `connectionFilterOf`'s members as the entries they are. */
export function connectionEntries(
  patch: Partial<ConnectionFilter>,
): Record<string, FieldPredicate[]> {
  return {
    ...('interchrom' in patch
      ? {
          [CONNECTION_INTERCHROM]: categoryEntries(
            CONNECTION_INTERCHROM,
            patch.interchrom,
          ),
        }
      : {}),
    ...('offscreenMates' in patch
      ? {
          [CONNECTION_OFFSCREEN]: categoryEntries(
            CONNECTION_OFFSCREEN,
            patch.offscreenMates,
          ),
        }
      : {}),
    ...(patch.minInterchromReads === undefined
      ? {}
      : {
          [BREAKPOINT_READS]: floorEntries(
            BREAKPOINT_READS,
            patch.minInterchromReads,
          ),
        }),
  }
}

// ---- the read fields' simple readings, for the menus and the dialog ----

/** The SAM flag bits that must be set and must be clear. */
export function flagMasksOf(predicates: readonly FieldPredicate[]) {
  let include = 0
  let exclude = 0
  for (const [i, field] of FLAG_FIELDS.entries()) {
    const category = categoryOf(predicates, field)
    if (category === 'only') {
      include |= 1 << i
    } else if (category === 'exclude') {
      exclude |= 1 << i
    }
  }
  return { include, exclude }
}

/** Every flag field's entries for two masks; a bit in neither tests nothing. */
export function flagEntries(
  include: number,
  exclude: number,
): Record<string, FieldPredicate[]> {
  return Object.fromEntries(
    FLAG_FIELDS.map((field, i) => {
      const bit = 1 << i
      return [
        field,
        include & bit
          ? [{ field, equal: true }]
          : exclude & bit
            ? [{ field, equal: false }]
            : [],
      ]
    }),
  )
}

/** The read name a read must have, if one is written as an `equal`. */
export function readNameOf(predicates: readonly FieldPredicate[]) {
  const equal = entriesOn(predicates, 'name').find(
    p => p.equal !== undefined,
  )?.equal
  return equal === undefined ? undefined : String(equal)
}

/** The tags a read must carry, as the dialog's rows edit them. */
export function tagFiltersOf(
  predicates: readonly FieldPredicate[],
): TagFilter[] {
  return predicates.flatMap(p =>
    isTagField(p.field) && (p.equal !== undefined || p.valid === true)
      ? [
          {
            tag: p.field.slice(TAG_FIELD_PREFIX.length),
            ...(p.equal === undefined ? {} : { value: String(p.equal) }),
          },
        ]
      : [],
  )
}

/**
 * The patch replacing every tag field: each tag's own entries, and an empty
 * list for a tag field written before and left out now.
 */
export function tagEntries(
  written: readonly FieldPredicate[],
  tags: readonly TagFilter[],
): Record<string, FieldPredicate[]> {
  const patch: Record<string, FieldPredicate[]> = {}
  for (const p of written) {
    if (isTagField(p.field)) {
      patch[p.field] = []
    }
  }
  for (const { tag, value } of tags) {
    if (tag !== '') {
      const field = `${TAG_FIELD_PREFIX}${tag}`
      patch[field] = [
        ...(patch[field] ?? []),
        value === undefined ? { field, valid: true } : { field, equal: value },
      ]
    }
  }
  return patch
}

// ---- the worker's three stages ----

/** What the adapters read off a record they parse. */
export interface FilterableRead {
  flags: number
  name: string | undefined
  getTag(tag: string): unknown
  cigarCategoryBits: number
}

const flagsOf = (read: FilterableRead) => read.flags

function recordLane(field: string): PredicateLane<FilterableRead> | undefined {
  if (field.startsWith(FLAG_FIELD_PREFIX)) {
    const i = FLAG_FIELDS.indexOf(field)
    return i === -1 ? undefined : { kind: 'bits', word: flagsOf, mask: 1 << i }
  }
  if (isTagField(field)) {
    const tag = field.slice(TAG_FIELD_PREFIX.length)
    return { kind: 'get', get: read => read.getTag(tag) }
  }
  return field === 'name'
    ? { kind: 'get', get: read => read.name }
    : field === 'spliced'
      ? {
          kind: 'get',
          get: read => (read.cigarCategoryBits & CIGAR_HAS_SKIP) !== 0,
        }
      : undefined
}

/**
 * The adapters' test, over the fields a record answers as it is parsed: its
 * flag bits, name, tags and whether its CIGAR skips. Undefined when the list
 * tests none of them.
 */
export function compileRecordFilter(
  predicates: readonly FieldPredicate[] | undefined,
) {
  return compilePredicates<FilterableRead>(
    (predicates ?? []).filter(p => isRecordField(p.field)),
    recordLane,
  )
}

/** The worker's sample test: the entries on `mapq`, over `mapqOf`. */
export function compileMapqFilter<T>(
  predicates: readonly FieldPredicate[] | undefined,
  mapqOf: (item: T) => number,
) {
  return compilePredicates<T>(entriesOn(predicates ?? [], MAPQ_FIELD), () => ({
    kind: 'get',
    get: mapqOf,
  }))
}

/** The entries on the read categories the worker answers per chain. */
export function chainPredicatesOf(
  predicates: readonly FieldPredicate[] | undefined,
) {
  return (predicates ?? []).filter(p => CHAIN_FIELDS.has(p.field))
}

// ---- problems ----

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
        ? [
            `filter: ${field} takes a floor (gte or gt), not ${JSON.stringify(p)}`,
          ]
        : []
    }
    if (ROW_CATEGORY_FIELDS.has(field)) {
      return testsSomething(p) && typeof p.equal !== 'boolean'
        ? [
            `filter: ${field} takes equal: true or false, not ${JSON.stringify(p)}`,
          ]
        : []
    }
    return isReadField(field)
      ? []
      : [`filter: no field ${JSON.stringify(field)} on an alignment`]
  })
}

// ---- the object form v4 and the first v5 betas wrote ----

interface FilterObject {
  flagInclude?: unknown
  flagExclude?: unknown
  minMapq?: unknown
  readName?: unknown
  tags?: unknown
  tagFilter?: unknown
  spliced?: unknown
  svSignal?: unknown
  alone?: unknown
  split?: unknown
  junctions?: { minReads?: unknown; nonCanonical?: unknown }
  connections?: {
    interchrom?: unknown
    offscreenMates?: unknown
    minInterchromReads?: unknown
  }
}

function isCategory(v: unknown): v is CategoryFilter {
  return v === 'only' || v === 'exclude'
}

/**
 * The predicate list an object-form `filter` says: v4's `filterBy` and the
 * object the first v5 betas wrote. A member left out keeps its default.
 */
export function predicatesOfFilterObject(
  object: FilterObject,
): FieldPredicate[] {
  let list: FieldPredicate[] = []
  const set = (
    patch: Record<string, readonly FieldPredicate[] | undefined>,
  ) => {
    list = withFields(list, patch)
  }
  const { flagInclude, flagExclude } = object
  if (typeof flagInclude === 'number' || typeof flagExclude === 'number') {
    set(
      flagEntries(
        typeof flagInclude === 'number' ? flagInclude : 0,
        typeof flagExclude === 'number' ? flagExclude : 1540,
      ),
    )
  }
  if (typeof object.minMapq === 'number') {
    set({ [MAPQ_FIELD]: [{ field: MAPQ_FIELD, gte: object.minMapq }] })
  }
  if (typeof object.readName === 'string') {
    set({ name: [{ field: 'name', equal: object.readName }] })
  }
  const tags = [
    ...(Array.isArray(object.tags) ? object.tags : []),
    ...(object.tagFilter ? [object.tagFilter] : []),
  ].filter(
    (t): t is TagFilter =>
      typeof t === 'object' && t !== null && typeof t.tag === 'string',
  )
  if (tags.length > 0) {
    set(tagEntries(list, tags))
  }
  for (const key of ['spliced', 'svSignal', 'alone', 'split'] as const) {
    const value = object[key]
    if (isCategory(value)) {
      set({ [key]: categoryEntries(key, value) })
    }
  }
  const { junctions = {}, connections = {} } = object
  set(
    junctionEntries({
      ...(typeof junctions.minReads === 'number'
        ? { minReads: junctions.minReads }
        : {}),
      ...(isCategory(junctions.nonCanonical)
        ? { nonCanonical: junctions.nonCanonical }
        : {}),
    }),
  )
  set(
    connectionEntries({
      ...(isCategory(connections.interchrom)
        ? { interchrom: connections.interchrom }
        : {}),
      ...(isCategory(connections.offscreenMates)
        ? { offscreenMates: connections.offscreenMates }
        : {}),
      ...(typeof connections.minInterchromReads === 'number'
        ? { minInterchromReads: connections.minInterchromReads }
        : {}),
    }),
  )
  return list
}
