import { samFlagNames } from '@jbrowse/cigar-utils'
import { getEnv, getSession } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { trackDisplayType } from '@jbrowse/core/util/tracks'
import {
  getSnapshot,
  getType,
  isArrayType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import {
  applySlotWrite,
  isMemberWrite,
  isSlotPathOption,
  mergeSettings,
  slotWrite,
} from './slotPath.ts'
import { trackMatches, trackName } from './trackFields.ts'

import type { AssertNever, AssertTrue, Covers, Track } from './types.ts'
import type { VariantSortColumn } from '@jbrowse/alignments-core/variantSortColumn'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'
import type {
  COMPACTNESS_PRESETS,
  CategoryFilter,
  LinearAlignmentsDisplayModel,
  ReadCategoryKey,
} from '@jbrowse/plugin-alignments'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-canvas'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  LinearMultiSampleVariantDisplayModel,
  LinearVariantDisplayModel,
} from '@jbrowse/plugin-variants'

// The filter half of an alignments display's state, as the CLI may state it.
// Every field optional: the ReadFilter schema fills the masks a partial one
// leaves out, and an absent category is an unfiltered one.
export type ReadFilterSnapshot = {
  flagInclude?: number
  flagExclude?: number
  tagFilters?: { tag: string; value: string }[]
} & Partial<Record<ReadCategoryKey, CategoryFilter>>

// The read-filter half of a snapshot's `filter`, which on a feature display is
// a jexl list instead; the alignments modifiers compose onto it.
function readFilterSnapOf(r: BuildResult): ReadFilterSnapshot {
  const { filter } = r.snap
  return filter && !Array.isArray(filter) ? filter : {}
}

// What `color:` names on an alignments track: a read field fills the reads and
// anything else is a CSS color. A per-base field is `baseColor:`'s.
const ALIGNMENTS_COLOR_FIELDS = new Set([
  'strand',
  'firstOfPairStrand',
  'mapq',
  'insertSize',
  'pairOrientation',
  'insertSizeAndOrientation',
  'mateRefName',
])
// `methylation` is the fill-unmarked view of the modifications field: one word
// for the everyday CpG picture, which otherwise needs the JSON escape hatch to
// reach the sibling `modifications` slot.
const BASE_COLORS = [
  'modifications',
  'methylation',
  'bisulfite',
  'baseQuality',
  'base',
] as const
const BASE_COLOR_NAMES: ReadonlySet<string> = new Set(BASE_COLORS)

// `color:` names a field on the color object a JSON modifier may already have
// started, so it merges rather than replaces.
function mergeColor(r: BuildResult, patch: Partial<ColorObject>) {
  r.snap.color = {
    ...(typeof r.snap.color === 'object' ? r.snap.color : {}),
    ...patch,
  }
}

// Display category: the family of display a track opens as, which says which
// translating modifiers write keys that display declares. `other` is a display
// none of them target, so it takes the all-tracks modifiers and slot writes
// alone.
export type Category =
  | 'alignments'
  | 'wiggle'
  | 'feature'
  | 'variant'
  | 'hic'
  | 'other'

// The linear display types a modifier targets. `trackCategory.test.ts` lists
// every registered display type and fails on one missing here, so a new display
// picks its family instead of falling to `other`.
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

// The display a `display:` modifier asks for, which the last one given wins.
export function requestedDisplayType(opts: string[]) {
  const name = opts.findLast(opt => opt.startsWith('display:'))?.slice(8)
  return name ? (lookup(displayTypeAliases, name)?.type ?? name) : undefined
}

// The category of the display a linear view opens `trackId` as, read off the
// session's own display picker so it follows `display:` and the adapter rather
// than a list of track types.
export function trackCategory(
  session: { getTrackById: (trackId: string) => unknown },
  trackId: string,
  opts: string[],
): Category {
  const conf = session.getTrackById(trackId)
  if (!conf) {
    return 'other'
  }
  const { pluginManager } = getEnv(session)
  const type = trackDisplayType(
    pluginManager,
    (isStateTreeNode(conf) ? getSnapshot(conf) : conf) as { type: string },
    'LinearGenomeView',
    requestedDisplayType(opts),
  )
  return (type ? lookup(categoryByDisplayType, type) : undefined) ?? 'other'
}

function matchTrackId(tracks: Track[], input: string, assemblyName: string) {
  const ids = new Set(tracks.map(t => t.trackId))
  const prefixed = `${assemblyName}-${input}`
  const target = input.toLowerCase()
  const prefix = `${assemblyName}-`.toLowerCase()
  const looseMatches = tracks.filter(t => {
    const id = t.trackId.toLowerCase()
    const unprefixed = id.startsWith(prefix) ? id.slice(prefix.length) : id
    return (
      id === target ||
      unprefixed === target ||
      trackName(t).toLowerCase() === target
    )
  })

  const resolved = ids.has(input)
    ? input
    : ids.has(prefixed)
      ? prefixed
      : looseMatches.length === 1
        ? looseMatches[0]!.trackId
        : undefined
  return { resolved, looseMatches }
}

// Resolve a user's --track token to a real trackId in the config. Hosted
// trackIds are all prefixed with the assembly name (e.g. hg19-ncbiRefSeqCurated),
// which is tedious to type, so this accepts: the exact id, the id with the
// `<assembly>-` prefix dropped, or a case-insensitive match on the id or the
// track's display name (when unambiguous). A miss throws with near-matches so the
// user can correct the token rather than getting a downstream "failed to open".
export function resolveTrackId(
  tracks: Track[],
  input: string,
  assemblyName: string,
): string {
  const { resolved, looseMatches } = matchTrackId(tracks, input, assemblyName)
  if (resolved !== undefined) {
    return resolved
  }
  if (looseMatches.length > 1) {
    throw new Error(
      `--track "${input}" is ambiguous; matches: ${looseMatches.map(t => t.trackId).join(', ')}`,
    )
  }
  const colon = input.indexOf(':')
  const glued =
    colon > 0
      ? matchTrackId(tracks, input.slice(0, colon), assemblyName).resolved
      : undefined
  if (glued !== undefined) {
    throw new Error(
      `--track "${input}" not found in the config; modifiers follow the trackId as separate arguments: --track ${glued} ${input.slice(colon + 1)}`,
    )
  }
  const suggestions = tracks
    .filter(t => trackMatches(t, input.toLowerCase()))
    .slice(0, 8)
    .map(t => t.trackId)
  throw new Error(
    `--track "${input}" not found in the config${suggestions.length ? `. Did you mean: ${suggestions.join(', ')}?` : ''}`,
  )
}

// Per-read height for the alignments compactness presets (spacing is derived
// from the height in the display, not stored). The canvas feature display
// expresses the same idea through its `displayMode` config slot instead.
//
// Duplicated rather than value-imported for the same reason as
// STRAND_COLOR_JEXL_LOCAL below — plugin-alignments is a devDependency here,
// used for display types alone. The assertion under it is the drift protection
// the old "three stable numbers" comment relied on a human for: every upstream
// preset must be present with that preset's exact featureHeight, so a renamed,
// added or resized preset fails the build.
const ALIGNMENTS_COMPACTNESS = {
  normal: 7,
  compact: 3,
  'super-compact': 1,
} as const

export type AssertCompactnessMatchesUpstream = AssertTrue<
  typeof ALIGNMENTS_COMPACTNESS extends {
    [
      K in keyof typeof COMPACTNESS_PRESETS
    ]: (typeof COMPACTNESS_PRESETS)[K]['featureHeight']
  }
    ? true
    : false
>

// The `heightMode` config-slot values, pinned to the upstream union so a mode
// added or renamed there fails the build here rather than leaving the CLI
// silently rejecting a mode the displays now accept.
const HEIGHT_MODES = [
  'fixed',
  'grow',
  'fit',
] as const satisfies readonly HeightMode[]

export type AssertHeightModesCoverUpstream = AssertTrue<
  Covers<HeightMode, typeof HEIGHT_MODES>
>

// Settings the named modifiers write into the snapshot passed to
// `view.showTrack`. Every other setting is a `path=value` slot write, which the
// display validates itself, so only what a modifier translates is typed here.
interface ColorObject {
  field?: string
  domain?: string[]
  range?: string[]
  scheme?: string
}

interface DisplaySnapshot {
  height?: number
  forceLoad?: boolean
  featureHeight?: number
  displayMode?: 'normal' | 'compact' | 'superCompact'
  heightMode?: HeightMode
  baseColor?: { field: string }
  modifications?: { fillUnmarked?: boolean }
  sortedBy?: {
    type: string
    pos: number
    refName: string
    assemblyName: string
    tag?: string
  }
  readConnections?: 'off' | 'arc' | 'cloud'
  readConnectionsDown?: boolean
  showSashimiArcs?: boolean
  sashimiArcsMode?: 'up' | 'down' | 'auto'
  // Lifted back out by `applyDisplayOpts` rather than passed to showTrack —
  // see there for why this one slot cannot ride in on the snapshot.
  filter?: ReadFilterSnapshot | string[]
  color?: string | ColorObject
  variantLayout?: 'genomic' | 'columns'
}

// Compile-time guard that every DisplaySnapshot key exists on a display model, so
// a property renamed upstream fails the build instead of going dead. `color`,
// `forceLoad`, `modifications` and `baseColor` are config slots read through
// differently named getters, which `keyof` the instance misses.
type ConfigSlotKey =
  | 'color'
  | 'forceLoad'
  | 'modifications'
  | 'baseColor'
  | 'filter'
type DisplayKeys =
  | keyof LinearAlignmentsDisplayModel
  | keyof LinearBasicDisplayModel
  | keyof LinearVariantDisplayModel
  | keyof LinearMultiSampleVariantDisplayModel
  | ConfigSlotKey

export type UnknownSnapshotKeys = Exclude<keyof DisplaySnapshot, DisplayKeys>
export type AssertSnapshotKeysExist = AssertNever<UnknownSnapshotKeys>

// The center-line sort is the one setting that depends on view state (the sort
// pivot is the genomic position under the view center), so it's parsed into this
// intent and resolved against the view before the snapshot is built.
interface BuildResult {
  snap: DisplaySnapshot
  sort?: { type: string; tag?: string }
  // An explicit display type picks a non-default display for the track (e.g. the
  // multi-sample variant matrix), passed to showTrack as the snapshot `type`.
  displayType?: string
}

// Friendly aliases for the displays a track type has beyond its default, so the
// CLI doesn't require the full state-model name, with any settings the alias
// implies. `display:<anything-else>` is passed through verbatim.
const displayTypeAliases: Record<
  string,
  { type: string; settings?: DisplaySnapshot }
> = {
  // The grammar-of-graphics display, which every track type a jb2export flag
  // builds but `--hic` can open. What it draws is the `marks` list, written as
  // `marks.0.mark=bar` and the rest, in the same paths as any other setting.
  marks: { type: 'LinearMarkDisplay' },
  multivariant: { type: 'LinearMultiSampleVariantDisplay' },
  multivariantmatrix: {
    type: 'LinearMultiSampleVariantDisplay',
    settings: { variantLayout: 'columns' },
  },
}

// The pileup sort types the layout recognizes (`sortLayout.ts`). `base` is the
// intuitive spelling the docs example uses, but the layout keys on `basePair` —
// an unrecognized type sorts nothing silently (it just falls through), so
// normalize the alias here rather than let `sort:base` become a no-op.
const sortTypeAliases: Record<string, string> = {
  base: 'basePair',
}

// Look a user-typed key up in a lookup table. `Object.hasOwn` rather than a bare
// index because every table here is keyed by raw CLI input, and `constructor` /
// `toString` / `hasOwnProperty` are inherited from Object.prototype — so
// `--bam x.bam constructor:1` found a "modifier" whose `on` was undefined and
// died on `.includes` instead of warning like any other unknown name.
function lookup<T>(table: Record<string, T>, key: string) {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

// One rule for every modifier value, so the grammar reads the same whatever the
// track type: a value that isn't one of the things the modifier accepts is an
// ERROR. jb2export writes a figure and exits, so a warning about a typo scrolls
// past and leaves a wrong image behind — `arcs:upp` used to render a plot with
// no arcs at all. (A modifier NAME is different: an unknown one, or one aimed at
// a track type it doesn't apply to, only warns — see applyModifier.)
function invalid(prefix: string, val: string, expected: string): never {
  throw new Error(
    val === ''
      ? `Missing ${prefix} value. Expected ${prefix}:<${expected}>.`
      : `Invalid ${prefix} value "${val}". Expected ${expected}.`,
  )
}

// A bare `height:` with nothing after the colon would otherwise become a silent
// 0 via `+''`. `expected` names the wider grammar for the modifiers that also
// accept keywords.
function parseNum(prefix: string, val: string, expected = 'a number') {
  const n = val === '' ? Number.NaN : +val
  return Number.isNaN(n) ? invalid(prefix, val, expected) : n
}

// A SAM flag mask, written as a number or as samtools' flag names.
//
// The names carry their own arithmetic — `SECONDARY,DUP` is an OR — so a reader
// who wants "drop secondary as well" writes that rather than working out that
// 1540 becomes 1796. A bad name lists the vocabulary, since twelve tokens is
// short enough to print and guessing one is the likely mistake.
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
            ? invalid(
                prefix,
                name,
                `a number or one of ${samFlagNames.join(', ')}`,
              )
            : 1 << i
        })
        .reduce((a, b) => a | b, 0)
}

// A modifier whose value is mandatory and free-form (a color, a tag, a display
// name). `color:` with nothing after the colon is a typo, not a request to color
// by the empty string — which would reach the display as an invalid config-slot
// value, or be dropped silently.
function parseStr(prefix: string, val: string, expected = 'value') {
  return val || invalid(prefix, val, expected)
}

// A modifier whose value comes from a fixed set (arcs, sashimi, heightMode, …).
// Returns the matched member so the caller keeps the narrow literal type.
function parseEnum<T extends string>(
  prefix: string,
  val: string,
  allowed: readonly T[],
) {
  return (
    allowed.find(a => a === val) ?? invalid(prefix, val, allowed.join(', '))
  )
}

// A modifier that reads as a flag: bare (`coverage`) or `:true` is on, `:false`
// is off, anything else is a typo. `getBooleanValue` in options.ts is the same
// question for a top-level --flag, where an unusable value warns rather than
// throws — the flags there are view cosmetics, these change what the image shows.
function parseBool(prefix: string, val: string) {
  return val === '' || val === 'true'
    ? true
    : val === 'false'
      ? false
      : invalid(prefix, val, 'true or false')
}

// Every category, for the modifiers that apply to any track type.
const ALL = [
  'alignments',
  'wiggle',
  'feature',
  'variant',
  'hic',
  'other',
] as const satisfies readonly Category[]

export type AssertAllCategoriesListed = AssertTrue<Covers<Category, typeof ALL>>

// Both of these open a display built on LinearCanvasBaseDisplay — the canvas
// feature display, and the variant display, which extends the very same schema.
// Every modifier that reads one of that base's slots (heightMode, featureHeight,
// …) therefore takes CANVAS, never one of the two alone: gating them apart is
// how `featureHeight:compact` came to work on a GFF track but not a VCF one.
const CANVAS = ['feature', 'variant'] as const satisfies readonly Category[]

// One `prefix:val1:val2` modifier: which display categories it writes for, and
// what it folds into the snapshot. Enumerating the categories — rather than
// re-deriving `isAlignments`/`isScore` inside each case — puts the gate in one
// place and lets the dispatcher report a modifier aimed at the wrong track type
// instead of dropping it silently. The `on` lists are the same grouping the
// README documents per track type.
interface Modifier {
  on: readonly Category[]
  apply: (
    result: BuildResult,
    val1: string,
    val2: string | undefined,
    category: Category,
  ) => void
}

// One modifier per read category, so the CLI cannot offer three of the four or
// spell one of them differently from the track menu. `all` is accepted and
// stores nothing, which is what makes a category scriptable from a variable
// that may be empty.
//
// The keys are listed rather than imported: this module reaches the display
// models through `import type` only, and a runtime import of the table would
// pull the alignments plugin into the CLI's own bundle. `Covers` below is what
// makes the list equivalent to importing it — a fifth category fails the build
// here and names itself.
const READ_CATEGORY_KEYS = [
  'spliced',
  'properPairs',
  'singletons',
  'split',
] as const
export type AssertAllReadCategoriesListed = AssertTrue<
  Covers<ReadCategoryKey, typeof READ_CATEGORY_KEYS>
>

function readCategoryModifiers(): Record<string, Modifier> {
  return Object.fromEntries(
    READ_CATEGORY_KEYS.map(key => [
      key,
      {
        on: ['alignments'],
        apply: (r: BuildResult, v: string) => {
          const choice = parseEnum(key, v, ['all', 'only', 'exclude'] as const)
          r.snap.filter = {
            ...readFilterSnapOf(r),
            ...(choice === 'all' ? {} : { [key]: choice }),
          }
        },
      } satisfies Modifier,
    ]),
  )
}

const modifiers: Record<string, Modifier> = {
  height: {
    on: ALL,
    apply: (r, v) => {
      r.snap.height = parseNum('height', v)
    },
  },
  force: {
    on: ALL,
    apply: (r, v) => {
      r.snap.forceLoad = parseBool('force', v)
    },
  },
  display: {
    on: ALL,
    apply: (r, v) => {
      const name = parseStr('display', v, 'display name')
      const alias = lookup(displayTypeAliases, name)
      r.displayType = alias?.type ?? name
      Object.assign(r.snap, alias?.settings)
    },
  },
  // `index:` (the .bai/.csi/.tbi location) and `name:` (the display name) are
  // consumed at config-build time in readData, so there's nothing to write to
  // the display snapshot — listed only so they aren't warned about as typos.
  index: { on: ALL, apply: () => {} },
  name: { on: ALL, apply: () => {} },

  // Track-height strategy, mirroring the `heightMode` config slot. `fixed`
  // scrolls to see all, `grow` resizes the track to fit everything, `fit`
  // shrinks content to fill the current height. An optional numeric second arg
  // sets the fixed track height in the same modifier, e.g. `heightMode:fit:200`.
  heightMode: {
    on: ['alignments', ...CANVAS],
    apply: (r, v, height) => {
      r.snap.heightMode = parseEnum('heightMode', v, HEIGHT_MODES)
      if (height !== undefined) {
        r.snap.height = parseNum('heightMode', height)
      }
    },
  },

  // The compactness presets map onto different fields per display: featureHeight
  // for alignments, the displayMode slot for the canvas-based displays. Both are
  // still plain snapshot values.
  featureHeight: {
    on: ['alignments', ...CANVAS],
    apply: (r, v, _v2, category) => {
      if (v === 'normal' || v === 'compact' || v === 'super-compact') {
        if (category === 'alignments') {
          r.snap.featureHeight = ALIGNMENTS_COMPACTNESS[v]
        } else {
          r.snap.displayMode = v === 'super-compact' ? 'superCompact' : v
        }
      } else {
        r.snap.featureHeight = parseNum(
          'featureHeight',
          v,
          'normal, compact, super-compact, or a number',
        )
      }
    },
  },

  // ——— alignments ———
  sort: {
    on: ['alignments'],
    apply: (r, v, tag) => {
      const type = parseStr('sort', v, 'sort type')
      r.sort = { type: lookup(sortTypeAliases, type) ?? type, tag }
    },
  },
  arcs: {
    on: ['alignments'],
    apply: (r, v) => {
      // a bare `arcs` once meant off, so the mode is required
      const mode = parseEnum('arcs', v, ['off', 'up', 'down', 'cloud'] as const)
      r.snap.readConnections = mode === 'cloud' || mode === 'off' ? mode : 'arc'
      if (mode === 'up' || mode === 'down') {
        r.snap.readConnectionsDown = mode === 'down'
      }
    },
  },
  sashimi: {
    on: ['alignments'],
    apply: (r, v) => {
      const mode = parseEnum('sashimi', v, ['off', 'up', 'down', 'auto'])
      r.snap.showSashimiArcs = mode !== 'off'
      if (mode !== 'off') {
        r.snap.sashimiArcsMode = mode
      }
    },
  },
  // The four read-category filters, one flag each and one vocabulary between
  // them: `only` keeps that category, `exclude` drops it, `all` (the default)
  // leaves it alone. `properPairs:exclude split:only` is the SV export.
  //
  // They filter BEFORE the coverage pipeline, not just before layout, so
  // `properPairs:exclude` on an ordinary sample removes almost every read and
  // the coverage band goes with them. That is the right behaviour (the band
  // should describe the reads that are drawn) and it is the thing to know
  // before reaching for one of these to tidy up an arc band.
  ...readCategoryModifiers(),
  // samtools' own vocabulary, because it is the one a reader of this flag
  // already has: `flags:include:exclude` is `-f` then `-F`. Each half is either
  // a number or samtools' flag NAMES, comma-separated and case-insensitive —
  // `flags::SECONDARY,DUP` says what `flags::1280` says, and says it to the
  // next reader too. Both halves are optional; an omitted one leaves that mask
  // wherever the track's own config left it.
  flags: {
    on: ['alignments'],
    apply: (r, include, exclude) => {
      r.snap.filter = {
        ...readFilterSnapOf(r),
        ...(include ? { flagInclude: parseFlagMask('flags', include) } : {}),
        ...(exclude ? { flagExclude: parseFlagMask('flags', exclude) } : {}),
      }
    },
  },
  // AND-ed with any other tag filter and with the flag masks above, which is
  // why this appends rather than assigns: `filterTag:HP:1 filterTag:RG:x` is two
  // conditions, not the second one.
  filterTag: {
    on: ['alignments'],
    apply: (r, tag, value) => {
      r.snap.filter = {
        ...readFilterSnapOf(r),
        tagFilters: [
          ...(readFilterSnapOf(r).tagFilters ?? []),
          {
            tag: parseStr('filterTag', tag, 'a SAM tag name'),
            value: value ?? '',
          },
        ],
      }
    },
  },

  // ——— coloring ———
  // The per-base layer over the reads, which combines with whatever `color:`
  // fills them with: `color:tag:HP baseColor:methylation`.
  baseColor: {
    on: ['alignments'],
    apply: (r, v) => {
      const value = parseEnum('baseColor', v, BASE_COLORS)
      r.snap.baseColor = {
        field: value === 'methylation' ? 'modifications' : value,
      }
      if (value === 'methylation') {
        r.snap.modifications = { fillUnmarked: true }
      }
    },
  },
  // `color:` names a constant, or one of the read fields the alignments display
  // paints, or `strand` on a canvas display. Any other field is
  // `color.field=tags.HP`, the slot's own spelling.
  color: {
    on: ALL,
    apply: (r, v, _v2, category) => {
      const value = parseStr('color', v, 'color scheme or CSS color')
      if (value === 'tag' || value === 'attribute') {
        invalid(
          'color',
          value,
          `a CSS color or a field name; a field of that name is color.field=${value === 'tag' ? 'tags.<TAG>' : '<name>'}`,
        )
      } else if (category === 'alignments') {
        if (BASE_COLOR_NAMES.has(value)) {
          invalid('color', value, `a read field; baseColor:${value} draws it`)
        } else if (ALIGNMENTS_COLOR_FIELDS.has(value)) {
          mergeColor(r, { field: value })
        } else {
          r.snap.color = value
        }
      } else if (category === 'hic') {
        if (!(COLOR_SCHEMES as readonly string[]).includes(value)) {
          invalid('color', value, `a color scheme: ${COLOR_SCHEMES.join(', ')}`)
        }
        mergeColor(r, { scheme: value })
      } else if (
        (category === 'feature' || category === 'variant') &&
        value === 'strand'
      ) {
        mergeColor(r, { field: 'strand' })
      } else {
        r.snap.color = value
      }
    },
  },
}

// Fold one `prefix:val1:val2` modifier into the display snapshot, or say why it
// did nothing. Modifier NAMES warn rather than throw — an unknown one for
// forward compatibility, and a well-known one aimed at the wrong track type
// because reusing one modifier list across a mixed set of files is a reasonable
// thing to script. (Modifier VALUES throw; see `invalid` above.) Either way it
// is now said out loud: `--bigwig sig.bw sashimi:up` used to look like it
// worked.
function applyModifier(
  result: BuildResult,
  category: Category,
  prefix: string,
  val1: string,
  val2: string | undefined,
) {
  const modifier = lookup(modifiers, prefix)
  if (!modifier) {
    console.warn(`Warning: unknown track option "${prefix}"`)
  } else if (!modifier.on.includes(category)) {
    console.warn(
      `Warning: track option "${prefix}" has no effect on ${category === 'other' ? 'this track type' : `a ${category} track`} (applies to: ${modifier.on.join(', ')})`,
    )
  } else {
    modifier.apply(result, val1, val2, category)
  }
}

// The snapshot as the open bag a slot write or a JSON modifier merges into: the
// display refuses a key it does not declare when the settings are applied, and
// jb2export fails on that report, so nothing here re-checks one.
function settingsOf(result: BuildResult) {
  return result.snap as Record<string, unknown>
}

// Raw JSON escape hatch for settings without a dedicated modifier. Reported with
// the offending token, since a bare SyntaxError from a shell-mangled brace names
// nothing.
function parseJsonModifier(opt: string): DisplaySnapshot {
  try {
    return JSON.parse(opt) as DisplaySnapshot
  } catch (e) {
    throw new Error(`Invalid JSON track option: ${opt}`, { cause: e })
  }
}

// Parse a track's modifier list into a declarative display snapshot. Pure (no
// view/display), so it's unit-testable; the center-line sort is returned as an
// intent for the caller to resolve against the view. A member write is
// `writeMembers`'s.
export function buildDisplaySnapshot(category: Category, opts: string[]) {
  const result: BuildResult = { snap: {} }
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      mergeSettings(
        settingsOf(result),
        settingsOf({ snap: parseJsonModifier(opt) }),
      )
    } else if (isSlotPathOption(opt)) {
      if (!isMemberWrite(opt)) {
        applySlotWrite(settingsOf(result), slotWrite(opt))
      }
    } else {
      const [prefix = '', val1 = '', val2] = opt.split(':')
      applyModifier(result, category, prefix, val1, val2)
    }
  }
  return result
}

// Open a track already known to the view's config (a `--bam` file whose adapter
// was built into the config, or a hosted `--track <id>`) with its display in the
// requested state. `trackId` is the exact id; `category` selects which modifiers
// apply. Shared by applyTrackOpts and the --track path.
// The last error the session was told, where the view sits in a session tree
function lastSessionError(view: LinearGenomeViewModel) {
  try {
    const { snackbarMessages } = getSession(view) as unknown as {
      snackbarMessages: { message: string; level?: string }[]
    }
    return snackbarMessages.findLast(m => m.level === 'error')?.message
  } catch {
    return undefined
  }
}

export async function applyDisplayOpts(
  view: LinearGenomeViewModel,
  trackId: string,
  category: Category,
  opts: string[],
  sortAt?: VariantSortColumn,
) {
  const { snap, sort, displayType } = buildDisplaySnapshot(category, opts)

  // Resolve the center-line sort against the view (the pivot is the genomic
  // position under the view center) and bake it into the snapshot. The view only
  // has a center line once it has displayed regions, so say when the sort is
  // dropped rather than render an unsorted pileup that looks like a sort bug.
  if (sort) {
    const center = view.centerLineInfo
    if (center && !center.oob) {
      snap.sortedBy = {
        type: sort.type,
        pos: basePaintedAt(center, center.offset),
        refName: center.refName,
        assemblyName: center.assemblyName,
        tag: sort.tag,
      }
    } else {
      console.warn(
        `Warning: sort:${sort.type} on "${trackId}" ignored — the view has no center position to sort at (pass --loc)`,
      )
    }
  } else if (sortAt && category === 'alignments') {
    const [region] = view.displayedRegions
    if (region) {
      snap.sortedBy = {
        ...sortAt,
        refName: region.refName,
        assemblyName: region.assemblyName,
      }
    }
  }

  // `filterBy` is the one slot a modifier EDITS rather than states, so it can't
  // ride in on the snapshot: the slot is `frozen`, and showTrack writes a frozen
  // slot by replacing the whole object. A track configured with
  // `filterBy: {flagExclude: 1796}` rendered with `split:only` would come back
  // with the schema's 1540 and its secondary alignments silently restored —
  // `flags:` says it keeps an omitted mask, and this is what made that untrue.
  // Applied after the open, through the display's own action, so each of
  // `flags:`, `filterTag:` and the four categories composes onto what the config
  // already said instead of erasing its siblings.
  const readFilter =
    typeof snap.filter === 'object' && !Array.isArray(snap.filter)
      ? snap.filter
      : undefined
  const { filter: _filter, ...rest } = snap
  const displaySnap = readFilter ? rest : snap

  // Create the display already in its target state rather than mutating a
  // default display with setter actions. An explicit `display:` selects a
  // non-default display via the snapshot `type` launchTrack reads.
  const opened = await view.launchTrack(
    trackId,
    {},
    displayType ? { ...displaySnap, type: displayType } : displaySnap,
  )
  // launchTrack returns undefined on any failure (invalid track config, or a
  // display: type that doesn't exist for this track) and says why to the
  // session's snackbar, which nothing shows here: name the track and carry the
  // reason, instead of a downstream "cannot read 'displays' of undefined".
  if (!opened) {
    const reason = lastSessionError(view)
    throw new Error(
      `Failed to open track "${trackId}"${displayType ? ` with display "${displayType}"` : ''}${reason ? `: ${reason}` : ''}`,
    )
  }
  if (readFilter) {
    const display = opened.displays[0] as
      | {
          readFilter?: ReadFilterSnapshot
          setReadFilter?: (f: unknown) => void
        }
      | undefined
    if (display?.setReadFilter) {
      const { tagFilters, ...members } = readFilter
      display.setReadFilter({
        ...display.readFilter,
        ...members,
        // AND-ed, like every other tag filter: a `filterTag:` on the command
        // line adds a condition to the track's own rather than replacing it.
        ...(tagFilters
          ? {
              tagFilters: [
                ...(display.readFilter?.tagFilters ?? []),
                ...tagFilters,
              ],
            }
          : {}),
      })
    } else {
      console.warn(
        `Warning: filter options on "${trackId}" ignored — its display has no read filter`,
      )
    }
  }
  writeMembers(view, trackId, opts)
}

/**
 * Write a track's `color.field=…` modifiers onto what its display in `view`
 * already has, after every other modifier, so a member write keeps the rest
 * of the setting whatever order the command line gives them in. A display
 * replaces a color or facet object whole, the way a session spec writes one,
 * which is why these cannot ride in on the launch snapshot.
 */
export function writeMembers(
  view: LinearGenomeViewModel,
  trackId: string,
  opts: string[],
) {
  const members = opts.filter(isMemberWrite)
  if (members.length > 0) {
    const track = view.tracks.find(t => t.configuration.trackId === trackId)
    if (!track) {
      throw new Error(
        `"${trackId}" is not open, so ${members.join(' ')} has nothing to write to`,
      )
    }
    const configuration = track.activeDisplay.configuration
    const configured: Record<string, unknown> = getSnapshot(configuration)
    const writes = members.map(slotWrite)
    const written = new Set(writes.map(write => write.segments[0]!))
    // a list at a default the snapshot strips, Manhattan's marks, still seeds
    // the write, so `marks.0.mark=bar` edits the mark drawn rather than an
    // empty one
    const seed = Object.fromEntries(
      [...written].flatMap(key => {
        const member: unknown = configuration[key]
        const value =
          configured[key] ??
          (isStateTreeNode(member) && isArrayType(getType(member))
            ? getSnapshot(member)
            : undefined)
        return value === undefined ? [] : [[key, value]]
      }),
    )
    view.showTrack(
      trackId,
      {},
      writes.reduce(applySlotWrite, structuredClone(seed)),
    )
  }
}
