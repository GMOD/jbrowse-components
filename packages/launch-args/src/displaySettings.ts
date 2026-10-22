import { samFlagNames } from '@jbrowse/cigar-utils'

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
// `displaySettingsGuards.ts` fails the build when one drifts from its plugin.

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

type ReadCategoryKey = (typeof READ_CATEGORY_KEYS)[number]

/**
 * The filter half of an alignments display's state, as a command line may
 * state it. Every field optional: the ReadFilter schema fills the masks a
 * partial one leaves out, and an absent category is an unfiltered one.
 */
export type ReadFilterSnapshot = {
  flagInclude?: number
  flagExclude?: number
  minMapq?: number
  tags?: { tag: string; value?: string }[]
  junctions?: Record<string, unknown>
  connections?: Record<string, unknown>
} & Partial<Record<ReadCategoryKey, 'only' | 'exclude' | null>>

export interface ColorObject {
  value?: string
  field?: string
  domain?: string[]
  range?: string[]
  scheme?: string
  scale?: unknown
}

/**
 * The settings the named modifiers write. Every other setting is a
 * `path=value` slot write, which the display validates itself.
 */
export interface DisplaySnapshot {
  height?: number
  forceLoad?: boolean
  featureHeight?: number
  displayMode?: 'normal' | 'compact' | 'superCompact'
  heightMode?: (typeof HEIGHT_MODES)[number]
  growMaxHeight?: number
  baseColor?: { field: string }
  modifications?: { unmodified?: 'hidden' | 'calls' | 'all' }
  sort?:
    | string
    | {
        field: string
        pos: number
        refName: string
        within?: number
      }
  pileup?: { readHeight?: number }
  readConnections?: {
    show?: boolean
    mark?: 'arc' | 'cloud'
    placement?: 'up' | 'down'
  }
  sashimi?: { show?: boolean; placement?: 'up' | 'down' | 'auto' }
  filter?: ReadFilterSnapshot | string[]
  color?: string | ColorObject
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

function readFilterOf(r: DisplaySettings): ReadFilterSnapshot {
  const { filter } = r.snap
  return filter && !Array.isArray(filter) ? filter : {}
}

function definedMembers(color: object) {
  return Object.fromEntries(
    Object.entries(color)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]),
  )
}

// display-kit's `colorForField`, as the Color by menu picks a field over a
// color a JSON modifier may have started: its key names and colors stay only
// while the field is the one they were written for.
function colorByField(r: DisplaySettings, field: string) {
  const current: ColorObject =
    typeof r.snap.color === 'object' ? r.snap.color : {}
  r.snap.color =
    field === current.field
      ? definedMembers({
          ...current,
          scale: current.scale === 'none' ? undefined : current.scale,
        })
      : definedMembers({ value: current.value, field })
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

/** The display a `display:` modifier asks for; the last one given wins. */
export function requestedDisplayType(modifiers: string[]) {
  const name = modifiers.findLast(mod => mod.startsWith('display:'))?.slice(8)
  return name ? (lookup(displayTypeAliases, name)?.type ?? name) : undefined
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

// The feature display and the variant display share LinearCanvasBaseDisplay's
// schema, so a modifier reading one of its slots takes both.
const CANVAS = ['feature', 'variant'] as const satisfies readonly Category[]

/**
 * One `prefix:val1:val2` modifier: the display categories it writes for, and
 * what it folds into the settings. `byCategory` marks a modifier whose write
 * itself differs by category, which a caller that cannot name the category
 * has to refuse.
 */
interface Modifier {
  on: readonly Category[]
  byCategory?: true
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

// `all` resets the category to unfiltered, which makes a category scriptable
// from a variable that may be empty. `null`, not `undefined`, so the reset
// survives a session spec's JSON.
function readCategoryModifiers(): Record<string, Modifier> {
  return Object.fromEntries(
    READ_CATEGORY_KEYS.map(key => [
      key,
      {
        on: ['alignments'],
        apply: (r: DisplaySettings, v: string) => {
          const choice = parseEnum(key, v, ['all', 'only', 'exclude'] as const)
          r.snap.filter = {
            ...readFilterOf(r),
            [key]: choice === 'all' ? null : choice,
          }
        },
      } satisfies Modifier,
    ]),
  )
}

const modifiers: Record<string, Modifier> = {
  height: {
    on: ALL_CATEGORIES,
    apply: (r, v) => {
      r.snap.height = parseNum('height', v)
    },
  },
  force: {
    on: ALL_CATEGORIES,
    apply: (r, v) => {
      r.snap.forceLoad = parseBool('force', v)
    },
  },
  display: {
    on: ALL_CATEGORIES,
    apply: (r, v) => {
      const name = parseStr('display', v, 'display name')
      const alias = lookup(displayTypeAliases, name)
      r.displayType = alias?.type ?? name
      Object.assign(r.snap, alias?.settings)
    },
  },
  // consumed while building the track's config
  index: { on: ALL_CATEGORIES, apply: () => {} },
  name: { on: ALL_CATEGORIES, apply: () => {} },

  // `heightMode:fit:200` sets the track height in the same modifier
  heightMode: {
    on: ['alignments', ...CANVAS],
    apply: (r, v, height) => {
      r.snap.heightMode = parseEnum('heightMode', v, HEIGHT_MODES)
      if (height !== undefined) {
        r.snap.height = parseNum('heightMode', height)
      }
    },
  },

  // alignments write `pileup.readHeight`, the canvas displays `displayMode`
  // or `featureHeight`
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
            readHeight: preset ? ALIGNMENTS_COMPACTNESS[preset] : height,
          },
        })
      } else if (preset) {
        r.snap.displayMode =
          preset === 'super-compact' ? 'superCompact' : preset
      } else {
        r.snap.featureHeight = height
      }
    },
  },

  sort: {
    on: ['alignments'],
    apply: (r, v, tag) => {
      const field = parseStr('sort', v, 'sort field')
      if (field === 'tag' && !tag) {
        invalidModifierValue('sort', v, 'tag:<TAG>')
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
              ? { show: true, mark: 'cloud' }
              : { show: true, mark: 'arc', placement: mode },
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
  // samtools' `-f` then `-F`; an omitted half leaves that mask as configured
  flags: {
    on: ['alignments'],
    apply: (r, include, exclude) => {
      r.snap.filter = {
        ...readFilterOf(r),
        ...(include ? { flagInclude: parseFlagMask('flags', include) } : {}),
        ...(exclude ? { flagExclude: parseFlagMask('flags', exclude) } : {}),
      }
    },
  },
  // samtools' `-q`
  mapq: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.filter = { ...readFilterOf(r), minMapq: parseNum('mapq', v) }
    },
  },
  // appends: `filterTag:HP:1 filterTag:RG:x` is two conditions
  filterTag: {
    on: ['alignments'],
    apply: (r, tag, value) => {
      r.snap.filter = {
        ...readFilterOf(r),
        tags: [
          ...(readFilterOf(r).tags ?? []),
          {
            tag: parseStr('filterTag', tag, 'a SAM tag name'),
            ...(value ? { value } : {}),
          },
        ],
      }
    },
  },

  // the per-base layer over the reads: `color:tag:HP baseColor:methylation`
  baseColor: {
    on: ['alignments'],
    apply: (r, v) => {
      const value = parseEnum('baseColor', v, BASE_COLORS)
      r.snap.baseColor = {
        field: value === 'methylation' ? 'modifications' : value,
      }
      if (value === 'methylation') {
        r.snap.modifications = { unmodified: 'all' }
      }
    },
  },
  // a constant, a read field on alignments, or `strand` on a canvas display;
  // any other field is `color.field=tags.HP`
  color: {
    on: ALL_CATEGORIES,
    byCategory: true,
    apply: (r, v, _v2, category) => {
      const value = parseStr('color', v, 'color scheme or CSS color')
      if (value === 'tag' || value === 'attribute') {
        invalidModifierValue(
          'color',
          value,
          `a CSS color or a field name; a field of that name is color.field=${value === 'tag' ? 'tags.<TAG>' : '<name>'}`,
        )
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
          r.snap.color = value
        }
      } else if (category === 'hic') {
        // `memberWrites` writes it as `color.scheme`, over the track's own color
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
        r.snap.color = value
      }
    },
  },
}

// An unknown name throws, as a misspelled slot does. A known one aimed at the
// wrong track type warns, because reusing one modifier list across a mixed set
// of files is a reasonable thing to script.
function applyModifier(
  result: DisplaySettings,
  category: Category | undefined,
  [prefix = '', val1 = '', val2]: string[],
  warn: (message: string) => void,
) {
  const modifier = lookup(modifiers, prefix)
  if (!modifier) {
    throw new Error(
      `unknown track option "${prefix}:"; the options are ${Object.keys(modifiers).join(', ')}, or a slot written as path=value`,
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
    modifier.apply(result, val1, val2, category)
  }
}

/**
 * A track's modifiers read into display settings, for the display `category`
 * names. Without a category, a modifier whose write depends on it throws, and
 * every other one writes its setting for the display to accept or refuse. A
 * member write is `memberWrites`'s, and `warn` hears of a modifier aimed at
 * another kind of track.
 */
export function buildDisplaySnapshot(
  category: Category | undefined,
  opts: string[],
  warn = (message: string) => {
    console.warn(`Warning: ${message}`)
  },
) {
  const result: DisplaySettings = { snap: {} }
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      mergeSettings(settingsOf(result), parseJsonModifier(opt))
    } else if (isSlotPathOption(opt)) {
      if (!isMemberWrite(opt)) {
        applySlotWrite(settingsOf(result), slotWrite(opt))
      }
    } else {
      applyModifier(result, category, opt.split(':'), warn)
    }
  }
  return result
}

/**
 * A track's member writes: each `color.field=…` modifier, and a hic track's
 * `color:<scheme>`, which names one member of the color object the track
 * already configures.
 */
export function memberWrites(category: Category | undefined, opts: string[]) {
  return opts.flatMap(opt =>
    isMemberWrite(opt)
      ? [opt]
      : category === 'hic' && opt.startsWith('color:')
        ? [`color.scheme=${opt.slice('color:'.length)}`]
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
