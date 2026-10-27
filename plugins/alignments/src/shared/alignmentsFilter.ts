import { CIGAR_HAS_SKIP } from '@jbrowse/cigar-utils'
import {
  withField as coreWithField,
  withFields as coreWithFields,
  compilePredicates,
  entriesOn,
  floorOf,
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
import {
  BREAKPOINT_READS,
  CHAIN_FIELDS,
  CONNECTION_INTERCHROM,
  CONNECTION_OFFSCREEN,
  FLAG_FIELDS,
  FLAG_FIELD_PREFIX,
  JUNCTION_CANONICAL,
  JUNCTION_CLASS,
  JUNCTION_READS,
  JUNCTION_SOURCE,
  MAPQ_FIELD,
  TAG_FIELD_PREFIX,
  fieldTag,
  isReadField,
  isRecordField,
} from './filterFields.ts'

import type { JunctionClass } from '../features/sashimi/junctionClass.ts'
import type {
  CategoryFilter,
  ConnectionFilter,
  JunctionFilter,
  JunctionFilterPatch,
  TagFilter,
} from './types.ts'
import type {
  FieldPredicate,
  FieldsPatch,
  PredicateLane,
} from '@jbrowse/core/util/fieldPredicate'

/**
 * The alignments display's `filter` (ADR-240): one predicate list, read where
 * each field can be answered. The adapters answer a record's own fields as
 * they parse it, the worker the mapping quality once the fetch is deduped and
 * the read categories once reads are grouped into chains, and the main thread
 * the splice junctions and the connections between reads.
 */

export { entriesOn } from '@jbrowse/core/util/fieldPredicate'
export {
  FLAG_FIELDS,
  FLAG_FIELD_PREFIX,
  filterProblems,
  isReadField,
} from './filterFields.ts'

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

/** Core's `withField`, over the alignments defaults. */
export function withField(
  written: readonly FieldPredicate[],
  field: string,
  entries: readonly FieldPredicate[] | undefined,
  defaults: readonly FieldPredicate[] = ALIGNMENTS_FILTER_DEFAULTS,
): FieldPredicate[] {
  return coreWithField(written, field, entries, defaults)
}

/** Core's `withFields`, over the alignments defaults. */
export function withFields(
  written: readonly FieldPredicate[],
  patch: FieldsPatch,
  defaults: readonly FieldPredicate[] = ALIGNMENTS_FILTER_DEFAULTS,
): FieldPredicate[] {
  return coreWithFields(written, patch, defaults)
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

/**
 * A count field's entries with its floor at `min`, none for 1 or less, each
 * other test `written` makes on the field (an `lte` cap) kept.
 */
export function floorEntries(
  written: readonly FieldPredicate[],
  field: string,
  min: number,
): FieldPredicate[] {
  return withLowerBound(
    entriesOn(written, field),
    field,
    min > 1 ? min : undefined,
  )
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
 * `junction.class` and clears `junction.source`, whose reading it folds in;
 * `sources` writes `junction.source` alone.
 */
export function junctionEntries(
  patch: JunctionFilterPatch,
  written: readonly FieldPredicate[] = [],
): Record<string, FieldPredicate[]> {
  const { classes, sources } = patch
  return {
    ...(patch.minReads === undefined
      ? {}
      : {
          [JUNCTION_READS]: floorEntries(
            written,
            JUNCTION_READS,
            patch.minReads,
          ),
        }),
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
    ...('sources' in patch
      ? {
          [JUNCTION_SOURCE]:
            sources === undefined ||
            JUNCTION_SOURCES.every(s => sources.includes(s))
              ? []
              : [{ field: JUNCTION_SOURCE, oneOf: [...sources] }],
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
  written: readonly FieldPredicate[] = [],
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
            written,
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

// A tag entry the dialog's rows can show: a value, or any value
function showsTag(p: FieldPredicate) {
  return (
    fieldTag(p.field) !== undefined &&
    (p.equal !== undefined || p.valid === true)
  )
}

/** The tags a read must carry, as the dialog's rows edit them. */
export function tagFiltersOf(
  predicates: readonly FieldPredicate[],
): TagFilter[] {
  return predicates.flatMap(p =>
    showsTag(p)
      ? [
          {
            tag: fieldTag(p.field)!,
            ...(p.equal === undefined ? {} : { value: String(p.equal) }),
          },
        ]
      : [],
  )
}

/**
 * The patch replacing every tag entry the rows show: each tag's own entries,
 * and an empty list for a tag field written before and left out now. Entries
 * the rows cannot show, such as `oneOf` or a bound, stay.
 */
export function tagEntries(
  written: readonly FieldPredicate[],
  tags: readonly TagFilter[],
): Record<string, FieldPredicate[]> {
  const patch: Record<string, FieldPredicate[]> = {}
  for (const p of written) {
    if (fieldTag(p.field) !== undefined) {
      patch[p.field] = [...(patch[p.field] ?? []), ...(showsTag(p) ? [] : [p])]
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

/** The read fields the "More filters..." dialog edits, as it shows them. */
export interface ReadFieldsForm {
  flagInclude: number
  flagExclude: number
  tags: TagFilter[]
  readName: string
  minMapq: number | undefined
  // a `gt` floor, kept through an edit of its number
  mapqStrict: boolean
}

export function readFieldsFormOf(
  predicates: readonly FieldPredicate[],
): ReadFieldsForm {
  const { include, exclude } = flagMasksOf(predicates)
  const mapq = floorOf(predicates, MAPQ_FIELD)
  return {
    flagInclude: include,
    flagExclude: exclude,
    tags: tagFiltersOf(predicates),
    readName: readNameOf(predicates) ?? '',
    minMapq: mapq?.min,
    mapqStrict: mapq?.strict ?? false,
  }
}

/**
 * The patch a Submit writes: only the sections `form` changes from `initial`,
 * each keeping the entries on its fields the dialog cannot show.
 */
export function readFieldsEntries(
  written: readonly FieldPredicate[],
  form: ReadFieldsForm,
  initial = readFieldsFormOf(written),
): Record<string, FieldPredicate[]> {
  return {
    ...(form.flagInclude === initial.flagInclude &&
    form.flagExclude === initial.flagExclude
      ? {}
      : flagEntries(form.flagInclude, form.flagExclude)),
    ...(JSON.stringify(form.tags) === JSON.stringify(initial.tags)
      ? {}
      : tagEntries(written, form.tags)),
    ...(form.readName === initial.readName
      ? {}
      : {
          name: [
            ...entriesOn(written, 'name').filter(p => p.equal === undefined),
            ...(form.readName === ''
              ? []
              : [{ field: 'name', equal: form.readName }]),
          ],
        }),
    ...(form.minMapq === initial.minMapq &&
    form.mapqStrict === initial.mapqStrict
      ? {}
      : {
          [MAPQ_FIELD]: withLowerBound(
            entriesOn(written, MAPQ_FIELD),
            MAPQ_FIELD,
            form.minMapq,
            form.mapqStrict,
          ),
        }),
  }
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
  const tag = fieldTag(field)
  if (tag !== undefined) {
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

// ---- v4's object form, which the v4.3.0 lifts read ----

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

// The fields an object-form `filter` writes over the defaults: a member the
// object names replaces its fields and `null` unsets them, and an omitted
// flag mask half keeps the default's.
function filterPatchOfObject(
  object: FilterObject,
): Record<string, FieldPredicate[]> {
  const o = object as Record<string, unknown>
  const patch: Record<string, FieldPredicate[]> = {}
  const { flagInclude, flagExclude, minMapq, readName } = object
  if (typeof flagInclude === 'number' || typeof flagExclude === 'number') {
    Object.assign(
      patch,
      flagEntries(
        typeof flagInclude === 'number'
          ? flagInclude
          : DEFAULT_FLAG_MASKS.include,
        typeof flagExclude === 'number'
          ? flagExclude
          : DEFAULT_FLAG_MASKS.exclude,
      ),
    )
  }
  if (given(o, 'minMapq')) {
    patch[MAPQ_FIELD] =
      typeof minMapq === 'number' ? [{ field: MAPQ_FIELD, gte: minMapq }] : []
  }
  if (given(o, 'readName')) {
    patch.name =
      typeof readName === 'string' ? [{ field: 'name', equal: readName }] : []
  }
  // v4's dialog asked for `*` to mean "any value", and its empty value kept
  // the reads lacking the tag, which nobody meant: both are any value
  const tags = [
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
  Object.assign(patch, tagEntries([], tags))
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
  return withFields([], filterPatchOfObject(object))
}

/** The adapters' drop test, over `compileRecordFilter`; drops nothing when no field applies. */
export function dropsRecord(filter: readonly FieldPredicate[] | undefined) {
  const keeps = compileRecordFilter(filter)
  return keeps ? (read: FilterableRead) => !keeps(read) : () => false
}
