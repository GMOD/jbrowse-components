import { samFlagNames } from '@jbrowse/cigar-utils'

import { displaySlotPaths } from './displaySlots.generated.ts'
import {
  invalidModifierValue,
  parseBool,
  parseEnum,
  parseJsonModifier,
  parseNum,
  parseStr,
} from './modifierValues.ts'
import {
  applySlotWrite,
  isMemberWrite,
  isSlotPathOption,
  mergeSettings,
  slotWrite,
} from './slotPath.ts'

// This module stays free of node and of every JBrowse package but
// cigar-utils, so Desktop's renderer imports it and jb2capture's install stays
// small. The lists the plugins also hold are copied here; jb2export's
// `applyTrackOpts.ts` fails the build when one drifts from its plugin.

/**
 * The family of display a track opens as, which says which modifiers write
 * keys that display declares. `other` takes the all-tracks modifiers and slot
 * writes alone.
 */
export type Category =
  | 'alignments'
  | 'wiggle'
  | 'feature'
  | 'variant'
  | 'hic'
  | 'other'

export { mergeSettings }

export const ALL_CATEGORIES = [
  'alignments',
  'wiggle',
  'feature',
  'variant',
  'hic',
  'other',
] as const satisfies readonly Category[]

// jb2export's `trackCategory.test.ts` lists every registered display type and
// fails on one missing here, so a new display picks its family instead of
// falling to `other`.
const categoryByDisplayType: Record<string, Category> = {
  LinearAlignmentsDisplay: 'alignments',
  LinearWiggleDisplay: 'wiggle',
  LinearHicDisplay: 'hic',
  LinearBasicDisplay: 'feature',
  LinearMultiRowFeatureDisplay: 'feature',
  LinearVariantDisplay: 'variant',
  LinearMultiSampleVariantDisplay: 'variant',
  LinearMarkDisplay: 'other',
  LinearManhattanDisplay: 'other',
  LinearMafDisplay: 'other',
  LDTrackDisplay: 'other',
  LinearReferenceSequenceDisplay: 'other',
  LinearSyntenyDisplay: 'other',
  LGVSyntenyDisplay: 'other',
  MultiWaySyntenyDisplay: 'other',
  DotplotDisplay: 'other',
  ChordSyntenyDisplay: 'other',
  ChordVariantDisplay: 'other',
}

export const categorizedDisplayTypes = Object.keys(categoryByDisplayType)

export function displayCategory(displayType: string | undefined): Category {
  return (
    (displayType ? lookup(categoryByDisplayType, displayType) : undefined) ??
    'other'
  )
}

// A display's slot paths, and which of them hold sub-slots: a written path is
// declared where it is a slot, or sits inside one that holds no sub-slots (a
// frozen object, a list).
const slotIndex = new Map<
  string,
  { slots: Set<string>; parents: Set<string> }
>()

function slotIndexOf(displayType: string) {
  let index = slotIndex.get(displayType)
  if (!index) {
    const paths = lookup(displaySlotPaths, displayType)
    if (!paths) {
      return undefined
    }
    const parents = new Set<string>()
    for (const path of paths) {
      const segments = path.split('.')
      for (let i = 1; i < segments.length; i++) {
        parents.add(segments.slice(0, i).join('.'))
      }
    }
    index = { slots: new Set(paths), parents }
    slotIndex.set(displayType, index)
  }
  return index
}

function declares(
  index: { slots: Set<string>; parents: Set<string> },
  path: string,
) {
  const segments = path.split('.')
  return segments.some((_, i) => {
    const prefix = segments.slice(0, i + 1).join('.')
    return (
      index.slots.has(prefix) && (prefix === path || !index.parents.has(prefix))
    )
  })
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// The leaf paths `after` writes that `before` did not hold as they are
function changedPaths(before: unknown, after: unknown, at = ''): string[] {
  if (isPlainObject(after) && Object.keys(after).length > 0) {
    const was = isPlainObject(before) ? before : {}
    return Object.entries(after).flatMap(([key, value]) =>
      changedPaths(was[key], value, at ? `${at}.${key}` : key),
    )
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [at]
}

// `Object.hasOwn` because every table here is keyed by raw command-line input,
// and `constructor` is inherited from Object.prototype.
function lookup<T>(table: Record<string, T>, key: string) {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

export const ALIGNMENTS_COLOR_FIELDS = [
  'strand',
  'firstOfPairStrand',
  'mapq',
  'insertSize',
  'pairOrientation',
  'insertSizeAndOrientation',
  'mateRefName',
  'mateAssembly',
] as const
const ALIGNMENTS_COLOR_FIELD_SET: ReadonlySet<string> = new Set(
  ALIGNMENTS_COLOR_FIELDS,
)

export const FACET_ONLY_FIELDS = [
  'pairing',
  'split',
  'spliced',
  'svSignal',
] as const
const FACET_ONLY_FIELD_SET: ReadonlySet<string> = new Set(FACET_ONLY_FIELDS)

// `methylation` is the fill-unmarked view of the modifications field: one word
// for the everyday CpG picture.
const BASE_COLORS = [
  'modifications',
  'methylation',
  'bisulfite',
  'baseQuality',
  'base',
] as const
const BASE_COLOR_NAMES: ReadonlySet<string> = new Set(BASE_COLORS)

export const COLOR_SCHEMES = [
  'viridis',
  'magma',
  'inferno',
  'cividis',
  'juicebox',
  'fall',
  'reds',
  'blues',
  'redblue',
  'purpleorange',
  'redgreyblue',
  'redyellowblue',
] as const

/** The alignments compactness presets' read heights. */
export const ALIGNMENTS_COMPACTNESS = {
  normal: 7,
  compact: 3,
  'super-compact': 1,
} as const

export const HEIGHT_MODES = ['fixed', 'grow', 'fit'] as const

export const READ_CATEGORY_KEYS = [
  'spliced',
  'svSignal',
  'alone',
  'split',
] as const

type Scalar = string | number | boolean

/**
 * One entry of a display's `filter`, core's `FieldPredicate` (ADR-238): the
 * tests a record's `field` must pass. On an alignments display (ADR-240) the
 * bare `{ field }` clears the field, defaults included.
 */
export interface FilterEntry {
  field: string
  equal?: Scalar
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  oneOf?: Scalar[]
  valid?: boolean
}

const isScalar = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
const isNumber = (v: unknown) => typeof v === 'number'

const FILTER_TESTS: Record<
  Exclude<keyof FilterEntry, 'field'>,
  (v: unknown) => boolean
> = {
  equal: isScalar,
  lt: isNumber,
  lte: isNumber,
  gt: isNumber,
  gte: isNumber,
  oneOf: v => Array.isArray(v) && v.every(isScalar),
  valid: v => typeof v === 'boolean',
}

function badFilterEntry(entry: unknown, why: string): never {
  throw new Error(
    `filter entry ${JSON.stringify(entry)} ${why}; an entry is { field, ${[...Object.keys(FILTER_TESTS), 'range'].join(' | ')} }, or a string, which means { field: <string>, equal: true }`,
  )
}

// a string is the config schema's shorthand
function filterEntryOf(entry: unknown): FilterEntry {
  if (typeof entry === 'string') {
    return entry
      ? { field: entry, equal: true }
      : badFilterEntry(entry, 'is empty')
  } else if (
    typeof entry !== 'object' ||
    entry === null ||
    Array.isArray(entry)
  ) {
    return badFilterEntry(entry, 'is not an object')
  }
  const { field, range, ...written } = entry as Record<string, unknown>
  if (typeof field !== 'string' || !field) {
    return badFilterEntry(entry, 'names no field')
  }
  const tests = range === undefined ? written : withRange(entry, written, range)
  for (const [name, value] of Object.entries(tests)) {
    const valid = lookup(FILTER_TESTS, name)
    if (!valid) {
      badFilterEntry(entry, `has no test "${name}"`)
    } else if (!valid(value)) {
      badFilterEntry(entry, `has a ${name} of the wrong type`)
    }
  }
  return { field, ...tests }
}

// Vega-Lite's `range`, as the config schema lifts it: [min, max], a null end
// open, the tighter bound winning beside a written gte or lte
function withRange(
  entry: unknown,
  tests: Record<string, unknown>,
  range: unknown,
) {
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    !range.every(end => end === null || typeof end === 'number')
  ) {
    return badFilterEntry(entry, 'has a range that is not [min, max]')
  }
  const [lo, hi] = range as [number | null, number | null]
  const { gte, lte } = tests
  return {
    ...tests,
    ...(lo === null
      ? {}
      : { gte: typeof gte === 'number' ? Math.max(gte, lo) : lo }),
    ...(hi === null
      ? {}
      : { lte: typeof lte === 'number' ? Math.min(lte, hi) : hi }),
  }
}

/**
 * A `filter` list as a JSON bag or a `filter=` write gives it, each entry
 * checked as the config schema checks one and a string read as its
 * shorthand. Throws on what the schema would refuse, v4's object form
 * included.
 */
export function filterEntriesOf(list: unknown): FilterEntry[] {
  if (!Array.isArray(list)) {
    throw new Error(
      `a filter is a list of { field, ... } entries, not ${JSON.stringify(list)}`,
    )
  }
  return list.map(filterEntryOf)
}

export interface ColorScaleObject {
  type?: string
  domain?: unknown[]
  range?: string[]
  names?: string[]
  scheme?: string
  reverse?: boolean
  unknown?: string
  invalid?: string
}

/** A color channel as written; a bare string is the field. */
export interface ColorObject {
  value?: string
  field?: string
  scale?: ColorScaleObject
  legend?: { title?: string; descending?: boolean }
}

export type ColorChannel = string | ColorObject

/**
 * The settings the named modifiers write. Every other setting is a
 * `path=value` slot write, which the display validates itself.
 */
export interface DisplaySnapshot {
  height?: number
  forceLoad?: boolean
  mark?: { height?: number }
  displayMode?: 'normal' | 'compact' | 'superCompact'
  heightMode?: (typeof HEIGHT_MODES)[number]
  growMaxHeight?: number
  sort?:
    | string
    | {
        field: string
        pos: number
        refName: string
        within?: number
      }
  pileup?: {
    mark?: { height?: number }
    bases?: {
      show?: boolean
      encoding?: { color?: string }
      unmodified?: { show?: boolean }
    }
  }
  readConnections?: {
    show?: boolean
    mark?: 'link' | 'rule'
    placement?: 'up' | 'down'
  }
  sashimi?: { show?: boolean; placement?: 'up' | 'down' | 'auto' }
  filter?: FilterEntry[]
  encoding?: { color?: ColorChannel }
  legend?: { show?: boolean }
  variantLayout?: 'genomic' | 'columns'
}

/**
 * A track's modifiers read into display settings. `sort` is the center-line
 * sort's field, which needs the view's center to become a setting, and
 * `displayType` the display `display:` picks.
 */
export interface DisplaySettings {
  snap: DisplaySnapshot
  sort?: { field: string }
  displayType?: string
}

// `entries` replace what the settings wrote on each field they name
function writeFilterFields(r: DisplaySettings, entries: FilterEntry[]) {
  const named = new Set(entries.map(p => p.field))
  r.snap.filter = [
    ...(r.snap.filter ?? []).filter(p => !named.has(p.field)),
    ...entries,
  ]
}

function listedValues(entries: readonly FilterEntry[]) {
  return entries.flatMap(p => [
    ...(p.equal === undefined ? [] : [p.equal]),
    ...(p.oneOf ?? []),
  ])
}

function setColor(r: DisplaySettings, color: ColorChannel) {
  r.snap.encoding = { ...r.snap.encoding, color }
}

// display-kit's `colorForField`, as the Color by menu picks a field over a
// color a JSON modifier may have started: its scale and key stay only while
// the field is the one they were written for.
function colorByField(r: DisplaySettings, field: string) {
  const written = r.snap.encoding?.color
  const current = typeof written === 'string' ? { field: written } : written
  setColor(
    r,
    field === current?.field
      ? structuredClone(written!)
      : current?.value === undefined
        ? field
        : { value: current.value, field },
  )
}

// Aliases for the displays a track type has beyond its default, with any
// settings the alias implies. `display:<anything-else>` passes through.
const displayTypeAliases: Record<
  string,
  { type: string; settings?: DisplaySnapshot }
> = {
  marks: { type: 'LinearMarkDisplay' },
  multivariant: { type: 'LinearMultiSampleVariantDisplay' },
  multivariantmatrix: {
    type: 'LinearMultiSampleVariantDisplay',
    settings: { variantLayout: 'columns' },
  },
}

function displayAlias(name: string) {
  return lookup(displayTypeAliases, name) ?? { type: name }
}

/** The display a `display:` modifier asks for; the last one given wins. */
export function requestedDisplayType(modifiers: string[]) {
  const name = modifiers.findLast(mod => mod.startsWith('display:'))?.slice(8)
  return name ? displayAlias(name).type : undefined
}

// `sort:basePair` is the spelling before the slot named the field `base`.
const sortFieldAliases: Record<string, string> = {
  basePair: 'base',
}

// A SAM flag mask, written as a number or as samtools' flag names, whose
// comma is an OR: `SECONDARY,DUP`.
function parseFlagMask(prefix: string, val: string) {
  return /^[0-9]+$/.test(val.trim())
    ? parseNum(prefix, val.trim())
    : val
        .split(',')
        .map(name => {
          const i = samFlagNames.indexOf(
            name.trim().toUpperCase() as (typeof samFlagNames)[number],
          )
          return i < 0
            ? invalidModifierValue(
                prefix,
                name,
                `a number or one of ${samFlagNames.join(', ')}`,
              )
            : 1 << i
        })
        .reduce((a, b) => a | b, 0)
}

// The feature display and the variant display share LinearFeatureBaseDisplay's
// schema, so a modifier reading one of its slots takes both.
const CANVAS = ['feature', 'variant'] as const satisfies readonly Category[]

/**
 * One `prefix:val1:val2` modifier: the display categories it writes for, and
 * what it folds into the settings, which lands only where the opened display
 * declares every slot it writes. `byCategory` marks a modifier whose write
 * itself differs by category, which a caller that cannot name the category
 * has to refuse. `vacuous` marks one a display without its slot already
 * satisfies, so it is skipped there unsaid. `values` is how many it reads, one
 * unless it says: `rest` gives `val2` everything after `val1`, colons
 * included, and a value past the count throws.
 */
interface Modifier {
  on: readonly Category[]
  byCategory?: true
  vacuous?: true
  values?: 2 | 'rest'
  apply: (
    result: DisplaySettings,
    val1: string,
    val2: string | undefined,
    category: Category | undefined,
  ) => void
}

function settingsOf(result: DisplaySettings) {
  return result.snap as Record<string, unknown>
}

// `all` writes the bare field, which clears what the track's config set and
// makes a category scriptable from a variable that may be empty.
function readCategoryModifiers(): Record<string, Modifier> {
  return Object.fromEntries(
    READ_CATEGORY_KEYS.map(field => [
      field,
      {
        on: ['alignments'],
        apply: (r: DisplaySettings, v: string) => {
          const choice = parseEnum(field, v, [
            'all',
            'only',
            'exclude',
          ] as const)
          writeFilterFields(r, [
            choice === 'all' ? { field } : { field, equal: choice === 'only' },
          ])
        },
      } satisfies Modifier,
    ]),
  )
}

// samtools' `-f` then `-F` over every flag field: a bit in neither mask
// clears its field, so `flags::256` also lifts the default exclusions
function flagEntries(include: number, exclude: number): FilterEntry[] {
  return samFlagNames.map((name, i) => {
    const field = `flags.${name}`
    const bit = 1 << i
    return include & bit
      ? { field, equal: true }
      : exclude & bit
        ? { field, equal: false }
        : { field }
  })
}

const modifiers: Record<string, Modifier> = {
  height: {
    on: ALL_CATEGORIES,
    apply: (r, v) => {
      r.snap.height = parseNum('height', v)
    },
  },
  // a display that never gates a large region has nothing to force
  force: {
    on: ALL_CATEGORIES,
    vacuous: true,
    apply: (r, v) => {
      r.snap.forceLoad = parseBool('force', v)
    },
  },
  display: {
    on: ALL_CATEGORIES,
    apply: (r, v) => {
      const { type, settings } = displayAlias(
        parseStr('display', v, 'display name'),
      )
      r.displayType = type
      Object.assign(r.snap, settings)
    },
  },
  // consumed while building the track's config
  index: { on: ALL_CATEGORIES, values: 'rest', apply: () => {} },
  name: { on: ALL_CATEGORIES, values: 'rest', apply: () => {} },

  // `heightMode:fit:200` sets the track height in the same modifier
  heightMode: {
    on: ['alignments', ...CANVAS],
    values: 2,
    apply: (r, v, height) => {
      r.snap.heightMode = parseEnum('heightMode', v, HEIGHT_MODES)
      if (height !== undefined) {
        r.snap.height = parseNum('heightMode', height)
      }
    },
  },

  // alignments write `pileup.mark.height`, the canvas displays `displayMode`
  // or `mark.height`
  featureHeight: {
    on: ['alignments', ...CANVAS],
    byCategory: true,
    apply: (r, v, _v2, category) => {
      const preset =
        v === 'normal' || v === 'compact' || v === 'super-compact'
          ? v
          : undefined
      const height = preset
        ? undefined
        : parseNum(
            'featureHeight',
            v,
            'normal, compact, super-compact, or a number',
          )
      if (category === 'alignments') {
        mergeSettings(settingsOf(r), {
          pileup: {
            mark: {
              height: preset ? ALIGNMENTS_COMPACTNESS[preset] : height,
            },
          },
        })
      } else if (preset) {
        r.snap.displayMode =
          preset === 'super-compact' ? 'superCompact' : preset
      } else {
        r.snap.mark = { height }
      }
    },
  },

  sort: {
    on: ['alignments'],
    values: 2,
    apply: (r, v, tag) => {
      const field = parseStr('sort', v, 'sort field')
      if (field === 'tag' && !tag) {
        invalidModifierValue('sort', v, 'tag:<TAG>')
      } else if (field !== 'tag' && tag !== undefined) {
        throw new Error(strayValueMessage('sort', 1, [tag]))
      }
      r.sort = {
        field:
          field === 'tag'
            ? `tags.${tag}`
            : (lookup(sortFieldAliases, field) ?? field),
      }
    },
  },
  arcs: {
    on: ['alignments'],
    apply: (r, v) => {
      const mode = parseEnum('arcs', v, ['off', 'up', 'down', 'cloud'] as const)
      mergeSettings(settingsOf(r), {
        readConnections:
          mode === 'off'
            ? { show: false }
            : mode === 'cloud'
              ? { show: true, mark: 'rule' }
              : { show: true, mark: 'link', placement: mode },
      })
    },
  },
  sashimi: {
    on: ['alignments'],
    apply: (r, v) => {
      const mode = parseEnum('sashimi', v, ['off', 'up', 'down', 'auto'])
      mergeSettings(settingsOf(r), {
        sashimi:
          mode === 'off' ? { show: false } : { show: true, placement: mode },
      })
    },
  },
  // They filter before the coverage pipeline, so `svSignal:only` on an
  // ordinary sample removes almost every read and the coverage band with them.
  ...readCategoryModifiers(),
  // an omitted half is mask 0
  flags: {
    on: ['alignments'],
    values: 2,
    apply: (r, include, exclude) => {
      writeFilterFields(
        r,
        flagEntries(
          include ? parseFlagMask('flags', include) : 0,
          exclude ? parseFlagMask('flags', exclude) : 0,
        ),
      )
    },
  },
  // samtools' `-q`
  mapq: {
    on: ['alignments'],
    apply: (r, v) => {
      writeFilterFields(r, [{ field: 'mapq', gte: parseNum('mapq', v) }])
    },
  },
  // a second value on one tag is an alternative, and a value keeps its
  // colons, as in `filterTag:RG:HG002:fc1:1`
  filterTag: {
    on: ['alignments'],
    values: 'rest',
    apply: (r, tag, value) => {
      const field = `tags.${parseStr('filterTag', tag, 'a SAM tag name')}`
      const values = value
        ? [
            ...new Set([
              ...listedValues(
                (r.snap.filter ?? []).filter(p => p.field === field),
              ),
              value,
            ]),
          ]
        : []
      writeFilterFields(r, [
        values.length === 0
          ? { field, valid: true }
          : values.length === 1
            ? { field, equal: values[0] }
            : { field, oneOf: values },
      ])
    },
  },

  // the per-base layer over the reads: `color:tag:HP baseColor:methylation`
  baseColor: {
    on: ['alignments'],
    apply: (r, v) => {
      const value = parseEnum('baseColor', v, BASE_COLORS)
      mergeSettings(settingsOf(r), {
        pileup: {
          bases: {
            show: true,
            encoding: {
              color: value === 'methylation' ? 'modifications' : value,
            },
            ...(value === 'methylation' ? { unmodified: { show: true } } : {}),
          },
        },
      })
    },
  },
  // a constant, a read field on alignments, or `strand` on a canvas display;
  // any other field is `encoding.color.field=tags.HP`
  color: {
    on: ALL_CATEGORIES,
    byCategory: true,
    values: 'rest',
    apply: (r, v, v2, category) => {
      const value = parseStr('color', v, 'color scheme or CSS color')
      if (value === 'tag' || value === 'attribute') {
        invalidModifierValue(
          'color',
          value,
          `a CSS color or a field name; a field of that name is encoding.color.field=${value === 'tag' ? 'tags.<TAG>' : '<name>'}`,
        )
      } else if (v2 !== undefined) {
        throw new Error(strayValueMessage('color', 1, [v2]))
      } else if (category === 'alignments') {
        if (BASE_COLOR_NAMES.has(value)) {
          invalidModifierValue(
            'color',
            value,
            `a read field; baseColor:${value} draws it`,
          )
        } else if (FACET_ONLY_FIELD_SET.has(value)) {
          invalidModifierValue(
            'color',
            value,
            `a field color paints; reads keep their arcs' colors, and facet=${value} groups them by ${value}`,
          )
        } else if (ALIGNMENTS_COLOR_FIELD_SET.has(value)) {
          colorByField(r, value)
        } else {
          setColor(r, { value })
        }
      } else if (category === 'hic') {
        // `memberWrites` writes it as `encoding.color.scale.scheme`, over the
        // track's own color
        if (!(COLOR_SCHEMES as readonly string[]).includes(value)) {
          invalidModifierValue(
            'color',
            value,
            `a color scheme: ${COLOR_SCHEMES.join(', ')}`,
          )
        }
      } else if (
        (category === 'feature' || category === 'variant') &&
        value === 'strand'
      ) {
        colorByField(r, 'strand')
      } else {
        setColor(r, { value })
      }
    },
  },
}

function strayValueMessage(prefix: string, count: number, extra: string[]) {
  return `track option "${prefix}:" takes ${count === 1 ? 'one value' : `${count} values`}, so ":${extra.join(':')}" applies to nothing`
}

function modifierArgs(prefix: string, modifier: Modifier, values: string[]) {
  const [val1 = '', ...after] = values
  if (modifier.values === 'rest') {
    return [val1, after.length ? after.join(':') : undefined] as const
  }
  const count = modifier.values ?? 1
  if (values.length > count) {
    throw new Error(strayValueMessage(prefix, count, values.slice(count)))
  }
  return [val1, after[0]] as const
}

/** The named track modifiers; any other setting is a `path=value` write. */
export const trackModifierNames = Object.keys(modifiers)

// An unknown name throws, as a misspelled slot does. A known one aimed at the
// wrong track type warns, because reusing one modifier list across a mixed set
// of files is a reasonable thing to script.
function applyModifier(
  result: DisplaySettings,
  opened: string | undefined,
  [prefix = '', ...values]: string[],
  warn: (message: string) => void,
) {
  const displayType = result.displayType ?? opened
  const category = displayType ? displayCategory(displayType) : undefined
  const modifier = lookup(modifiers, prefix)
  if (!modifier) {
    throw new Error(
      `unknown track option "${prefix}:"; the options are ${trackModifierNames.join(', ')}, or a slot written as path=value`,
    )
  } else if (!category && modifier.byCategory) {
    throw new Error(
      `track option "${prefix}:" writes a different setting on each kind of track, and this app opens the track without knowing which; write the setting as path=value`,
    )
  } else if (category && !modifier.on.includes(category)) {
    warn(
      `track option "${prefix}" has no effect on ${category === 'other' ? 'this track type' : `a ${category} track`} (applies to: ${modifier.on.join(', ')})`,
    )
  } else {
    const [val1, val2] = modifierArgs(prefix, modifier, values)
    const before = structuredClone(result)
    modifier.apply(result, val1, val2, category)
    const landsOn = result.displayType ?? displayType
    const index = landsOn ? slotIndexOf(landsOn) : undefined
    const undeclared = index
      ? [
          ...changedPaths(before.snap, result.snap),
          ...changedPaths(before.sort, result.sort, 'sort'),
        ].filter(path => !declares(index, path))
      : []
    if (undeclared.length > 0) {
      Object.assign(result, before)
      for (const key of ['sort', 'displayType'] as const) {
        if (!(key in before)) {
          delete result[key]
        }
      }
      if (!modifier.vacuous) {
        warn(
          `track option "${prefix}" has no effect on ${landsOn}, which has no ${undeclared.join(', ')} setting`,
        )
      }
    }
  }
}

/**
 * A track's modifiers read into display settings for `displayType`, the
 * display the track opens as. A named modifier writes only slots that display
 * declares. Without a display type, a modifier whose write depends on it
 * throws, and every other one writes its setting for the display to accept or
 * refuse. A member write is `memberWrites`'s, and `warn` hears of a modifier
 * that does nothing on the display.
 */
export function buildDisplaySnapshot(
  displayType: string | undefined,
  opts: string[],
  warn = (message: string) => {
    console.warn(`Warning: ${message}`)
  },
) {
  const result: DisplaySettings = { snap: {} }
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      const { filter, ...rest } = parseJsonModifier(opt)
      mergeSettings(settingsOf(result), rest)
      if (filter !== undefined) {
        writeFilterFields(result, filterEntriesOf(filter))
      }
    } else if (isSlotPathOption(opt)) {
      if (!isMemberWrite(opt)) {
        const write = slotWrite(opt)
        if (write.segments[0] === 'filter') {
          writeFilterFields(result, filterEntriesOf([write.value].flat()))
        } else {
          applySlotWrite(settingsOf(result), write)
        }
      }
    } else {
      applyModifier(result, displayType, opt.split(':'), warn)
    }
  }
  return result
}

/**
 * Throws for a modifier no kind of track takes: an unknown name, a malformed
 * slot write, or a value each display it applies to refuses. An app that
 * applies the modifiers only once the track is open checks them first, so the
 * command line fails rather than the open.
 */
export function checkModifiers(opts: string[]) {
  for (const opt of opts) {
    if (isMemberWrite(opt)) {
      slotWrite(opt)
      continue
    }
    let refusal: unknown
    const taken = categorizedDisplayTypes.some(displayType => {
      let applies = true
      try {
        buildDisplaySnapshot(displayType, [opt], () => {
          applies = false
        })
        return applies
      } catch (e) {
        refusal ??= e
        return false
      }
    })
    if (!taken) {
      throw refusal instanceof Error
        ? refusal
        : new Error(`track option "${opt}" applies to no kind of track`)
    }
  }
}

/**
 * A track's member writes: each `encoding.color.field=…` modifier, and a hic
 * track's `color:<scheme>`, which names one member of the color channel the
 * track already configures.
 */
export function memberWrites(displayType: string | undefined, opts: string[]) {
  return opts.flatMap(opt =>
    isMemberWrite(opt)
      ? [opt]
      : displayType !== undefined &&
          displayCategory(displayType) === 'hic' &&
          opt.startsWith('color:')
        ? [`encoding.color.scale.scheme=${opt.slice('color:'.length)}`]
        : [],
  )
}

/**
 * The patch a track's member writes make: each write applied over the value
 * `configured` gives the setting it names, so the rest of that setting stays.
 */
export function memberPatch(
  members: string[],
  configured: (setting: string) => unknown,
) {
  const writes = members.map(slotWrite)
  const seed = Object.fromEntries(
    [...new Set(writes.map(write => write.segments[0]!))].flatMap(setting => {
      const value = configured(setting)
      return value === undefined ? [] : [[setting, value]]
    }),
  )
  return writes.reduce(applySlotWrite, structuredClone(seed))
}
