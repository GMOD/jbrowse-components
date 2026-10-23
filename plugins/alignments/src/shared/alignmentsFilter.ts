import { CIGAR_HAS_SKIP, samFlagNames } from '@jbrowse/cigar-utils'
import {
  compilePredicates,
  testsSomething,
  withLowerBound,
} from '@jbrowse/core/util/fieldPredicate'
import {
  categoryEntries,
  categoryOf,
} from '@jbrowse/display-kit/categoryFilter'

import {
  JUNCTION_CLASSES,
  JUNCTION_SOURCES,
  junctionSource,
} from '../features/sashimi/junctionClass.ts'
import { TAG_FIELD_PREFIX } from './facetLabels.ts'

import type { JunctionClass } from '../features/sashimi/junctionClass.ts'
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
const JUNCTION_CLASS = 'junction.class'
const JUNCTION_SOURCE = 'junction.source'
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
// and a closed vocabulary its values, by `equal` or `oneOf`
const ROW_VALUE_FIELDS = new Map<string, readonly string[]>([
  [JUNCTION_CLASS, JUNCTION_CLASSES],
  [JUNCTION_SOURCE, JUNCTION_SOURCES],
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

// The supporting-read floor for a splice junction: a single-read junction is
// dominated by alignment noise, and unreadable at the 1px stroke
// `strokeWidthForCount` floors it to.
export const DEFAULT_MIN_SASHIMI_READS = 2

// The reads an inter-chromosomal breakpoint must gather before its connector
// ticks draw, for the same reason: single-read marks are dominated by
// mismapping. They are counted over one fragment length on both sides rather
// than at a coordinate, since a mate pair straddles a breakpoint instead of
// landing on it (`clusteredInterchromSupport`). On HG002 300x, 200 kb at
// 1:2,000,000, 844 of 856 breakpoints carried exactly one read, and widening
// the window from 0 to 2 kb merged only five clusters, so they are scattered
// rather than badly keyed, which is what makes them droppable.
export const DEFAULT_MIN_INTERCHROM_READS = 2

/**
 * What applies with nothing written: unmapped, QC-failed and duplicate reads
 * out (samtools' 1540), and a floor of two reads under a splice junction and
 * under an inter-chromosomal breakpoint.
 */
export const ALIGNMENTS_FILTER_DEFAULTS: readonly FieldPredicate[] = [
  { field: 'flags.UNMAP', equal: false },
  { field: 'flags.QCFAIL', equal: false },
  { field: 'flags.DUP', equal: false },
  { field: JUNCTION_READS, gte: DEFAULT_MIN_SASHIMI_READS },
  { field: BREAKPOINT_READS, gte: DEFAULT_MIN_INTERCHROM_READS },
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

function junctionClassLane(
  field: string,
): PredicateLane<JunctionClass> | undefined {
  return field === JUNCTION_CLASS
    ? { kind: 'get', get: c => c }
    : field === JUNCTION_SOURCE
      ? { kind: 'get', get: junctionSource }
      : undefined
}

// The `junction.class` and `junction.source` entries as the classes they
// admit, undefined when they test nothing.
function junctionClassesOf(predicates: readonly FieldPredicate[]) {
  const admits = compilePredicates(
    predicates.filter(
      p => p.field === JUNCTION_CLASS || p.field === JUNCTION_SOURCE,
    ),
    junctionClassLane,
  )
  return admits && JUNCTION_CLASSES.filter(admits)
}

/** The junctions drawn, as the sashimi and tables code test them. */
export function junctionFilterOf(
  predicates: readonly FieldPredicate[],
): JunctionFilter {
  const canonical = categoryOf(predicates, JUNCTION_CANONICAL)
  return {
    classes: junctionClassesOf(predicates),
    minReads: countFloorOf(predicates, JUNCTION_READS) ?? 1,
    nonCanonical:
      canonical === 'only'
        ? 'exclude'
        : canonical === 'exclude'
          ? 'only'
          : undefined,
  }
}

/**
 * `junctionFilterOf`'s members as the entries they are. `classes` writes
 * `junction.class` and clears `junction.source`, whose reading it folds in.
 */
export function junctionEntries(
  patch: Partial<JunctionFilter>,
): Record<string, FieldPredicate[]> {
  const { classes } = patch
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
    ...('classes' in patch
      ? {
          [JUNCTION_CLASS]:
            classes === undefined ||
            JUNCTION_CLASSES.every(c => classes.includes(c))
              ? []
              : [{ field: JUNCTION_CLASS, oneOf: [...classes] }],
          [JUNCTION_SOURCE]: [],
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

/** The SAM flag bits the defaults require and exclude: 0 and 1540. */
export const DEFAULT_FLAG_MASKS = flagMasksOf(ALIGNMENTS_FILTER_DEFAULTS)

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
            `filter: ${field} takes equal or oneOf of ${vocabulary.join(', ')}, not ${JSON.stringify(p)}`,
          ]
        : []
    }
    return isReadField(field)
      ? []
      : [`filter: no field ${JSON.stringify(field)} on an alignment`]
  })
}

// ---- the object form: v4's, and what a launch modifier writes ----

export interface FilterObject {
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
  junctions?: unknown
  connections?: unknown
}

function membersOf(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null
    ? (v as Record<string, unknown>)
    : {}
}

function isCategory(v: unknown): v is CategoryFilter {
  return v === 'only' || v === 'exclude'
}

const OBJECT_MEMBERS: Record<string, readonly string[] | undefined> = {
  flagInclude: undefined,
  flagExclude: undefined,
  minMapq: undefined,
  readName: undefined,
  tags: undefined,
  tagFilter: undefined,
  spliced: undefined,
  svSignal: undefined,
  alone: undefined,
  split: undefined,
  junctions: ['minReads', 'nonCanonical', 'classes'],
  connections: ['interchrom', 'offscreenMates', 'minInterchromReads'],
}

/**
 * The members an object-form filter names that it does not have, as dotted
 * paths: what a write refuses, so a typo is an error rather than an
 * unfiltered track.
 */
export function strayFilterMembers(object: Record<string, unknown>) {
  return Object.entries(object).flatMap(([key, value]) => {
    if (!(key in OBJECT_MEMBERS)) {
      return [key]
    }
    const nested = OBJECT_MEMBERS[key]
    return nested && typeof value === 'object' && value !== null
      ? Object.keys(value)
          .filter(k => !nested.includes(k))
          .map(k => `${key}.${k}`)
      : []
  })
}

// A member a patch names: a value, or `null` for unset
function given(object: Record<string, unknown>, key: string) {
  return key in object && object[key] !== undefined
}

function categoryOrUnset(v: unknown): CategoryFilter | undefined {
  return isCategory(v) ? v : undefined
}

function junctionClassListOrUnset(v: unknown) {
  return Array.isArray(v)
    ? JUNCTION_CLASSES.filter(c => v.includes(c))
    : undefined
}

/**
 * The fields an object-form `filter` writes, composed onto `current` (a
 * merged list) as the track menu composes: a member the object names
 * replaces its fields and `null` unsets them, an omitted flag mask half keeps
 * `current`'s, and `tags` add to the tags `current` holds. What a launch
 * modifier and a JSON settings bag write.
 */
export function filterPatchOfObject(
  object: FilterObject,
  current: readonly FieldPredicate[],
): Record<string, FieldPredicate[]> {
  const o = object as Record<string, unknown>
  const patch: Record<string, FieldPredicate[]> = {}
  const { flagInclude, flagExclude } = object
  if (typeof flagInclude === 'number' || typeof flagExclude === 'number') {
    const masks = flagMasksOf(current)
    Object.assign(
      patch,
      flagEntries(
        typeof flagInclude === 'number' ? flagInclude : masks.include,
        typeof flagExclude === 'number' ? flagExclude : masks.exclude,
      ),
    )
  }
  if (given(o, 'minMapq')) {
    patch[MAPQ_FIELD] = withLowerBound(
      entriesOn(current, MAPQ_FIELD),
      MAPQ_FIELD,
      typeof object.minMapq === 'number' ? object.minMapq : undefined,
    )
  }
  if (given(o, 'readName')) {
    patch.name =
      typeof object.readName === 'string'
        ? [{ field: 'name', equal: object.readName }]
        : []
  }
  // v4's dialog asked for `*` to mean "any value", and its empty value kept
  // the reads lacking the tag, which nobody meant: both are any value
  const added = [
    ...(Array.isArray(object.tags) ? object.tags : []),
    ...(object.tagFilter ? [object.tagFilter] : []),
  ]
    .filter(
      (t): t is TagFilter =>
        typeof t === 'object' && t !== null && typeof t.tag === 'string',
    )
    .map(({ tag, value }) =>
      value === undefined || value === '*' || value === ''
        ? { tag }
        : { tag, value },
    )
  if (given(o, 'tags') || added.length > 0) {
    Object.assign(
      patch,
      tagEntries(current, [
        ...(object.tags === null ? [] : tagFiltersOf(current)),
        ...added,
      ]),
    )
  }
  for (const key of ['spliced', 'svSignal', 'alone', 'split'] as const) {
    if (given(o, key)) {
      patch[key] = categoryEntries(key, categoryOrUnset(object[key]))
    }
  }
  const junctions = membersOf(object.junctions)
  Object.assign(
    patch,
    junctionEntries({
      ...(typeof junctions.minReads === 'number'
        ? { minReads: junctions.minReads }
        : {}),
      ...(given(junctions, 'nonCanonical')
        ? { nonCanonical: categoryOrUnset(junctions.nonCanonical) }
        : {}),
      ...(given(junctions, 'classes')
        ? { classes: junctionClassListOrUnset(junctions.classes) }
        : {}),
    }),
  )
  const connections = membersOf(object.connections)
  Object.assign(
    patch,
    connectionEntries({
      ...(given(connections, 'interchrom')
        ? { interchrom: categoryOrUnset(connections.interchrom) }
        : {}),
      ...(given(connections, 'offscreenMates')
        ? { offscreenMates: categoryOrUnset(connections.offscreenMates) }
        : {}),
      ...(typeof connections.minInterchromReads === 'number'
        ? { minInterchromReads: connections.minInterchromReads }
        : {}),
    }),
  )
  return patch
}

/**
 * The predicate list a v4.3.0 session or config's filter object says: its
 * `filterBy`, the instance's `drawSingletons` and the read arcs display's
 * draw verbs, each member over the defaults.
 */
export function predicatesOfFilterObject(
  object: FilterObject,
): FieldPredicate[] {
  return withFields([], filterPatchOfObject(object, ALIGNMENTS_FILTER_DEFAULTS))
}

/** The adapters' drop test, over `compileRecordFilter`; drops nothing when no field applies. */
export function dropsRecord(filter: readonly FieldPredicate[] | undefined) {
  const keeps = compileRecordFilter(filter)
  return keeps ? (read: FilterableRead) => !keeps(read) : () => false
}
