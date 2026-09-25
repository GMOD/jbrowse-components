import { samFlagNames } from '@jbrowse/cigar-utils'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  isMemberWrite,
  isSlotPathOption,
  mergeSettings,
  slotPathSettings,
} from './slotPath.ts'
import { trackMatches, trackName } from './trackFields.ts'

import type { AssertNever, AssertTrue, Covers, Track } from './types.ts'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  COMPACTNESS_PRESETS,
  CategoryFilter,
  LinearAlignmentsDisplayModel,
  ReadCategoryKey,
} from '@jbrowse/plugin-alignments'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-canvas'
import type { LinearHicDisplayModel } from '@jbrowse/plugin-hic'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  LinearMultiSampleVariantDisplayModel,
  LinearVariantDisplayModel,
} from '@jbrowse/plugin-variants'
import type linearWiggleDisplayModelFactory from '@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel'

// The filter half of an alignments display's state, as the CLI may state it.
// Every field optional: `normalizeFilterBy` on the display side fills the masks
// a partial one leaves out, and an absent category is an unfiltered one.
export type FilterBySnapshot = {
  flagInclude?: number
  flagExclude?: number
  tagFilters?: { tag: string; value: string }[]
} & Partial<Record<ReadCategoryKey, CategoryFilter>>

type WiggleDisplayModel = Instance<
  ReturnType<typeof linearWiggleDisplayModelFactory>
>

// What `color:` names on an alignments track: a read field fills the reads and
// anything else is a CSS colour. A per-base field is `baseColor:`'s.
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

// `color:` names a field on the colour object a JSON modifier may already have
// started, so it merges rather than replaces.
function mergeColor(r: BuildResult, patch: Partial<ColorObject>) {
  r.snap.color = {
    ...(typeof r.snap.color === 'object' ? r.snap.color : {}),
    ...patch,
  }
}

// Display category: which display a track opens with, and so which snapshot keys
// are meaningful for it. Lets us build the right snapshot before the display
// instance exists, and gate each modifier to the track types it applies to.
export type Category = 'alignments' | 'wiggle' | 'feature' | 'variant' | 'hic'

// The one track-type -> category table, keyed by the config track's own `type`.
// Every track reaches the view through the config — a hosted one named by
// --track, and a `--bam`/`--bigwig` file whose config readData built — so the
// category is read off the config for both rather than derived a second way from
// the CLI flag. Anything unlisted (FeatureTrack and friends) drives a feature
// display.
const categoryByTrackType: Record<string, Category> = {
  AlignmentsTrack: 'alignments',
  QuantitativeTrack: 'wiggle',
  MultiQuantitativeTrack: 'wiggle',
  VariantTrack: 'variant',
  MultiVariantTrack: 'variant',
  HicTrack: 'hic',
}

export function configTrackCategory(
  tracks: Track[],
  trackId: string,
): Category {
  const type = tracks.find(t => t.trackId === trackId)?.type
  return (
    (typeof type === 'string' ? categoryByTrackType[type] : undefined) ??
    'feature'
  )
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

  if (resolved === undefined) {
    if (looseMatches.length > 1) {
      throw new Error(
        `--track "${input}" is ambiguous; matches: ${looseMatches.map(t => t.trackId).join(', ')}`,
      )
    }
    const suggestions = tracks
      .filter(t => trackMatches(t, target))
      .slice(0, 8)
      .map(t => t.trackId)
    throw new Error(
      `--track "${input}" not found in the config${suggestions.length ? `. Did you mean: ${suggestions.join(', ')}?` : ''}`,
    )
  }
  return resolved
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

// The canvas displays' `color` is a CSS color or jexl, or `{ field }` for a
// field's values through a palette: `color:strand` and `color:attribute:X`
// name the field, and anything else is the color.
function canvasColor(value: string, arg: string | undefined) {
  return {
    color:
      value === 'strand'
        ? { field: 'strand' }
        : value === 'attribute'
          ? {
              field: parseStr('color:attribute', arg ?? '', 'attribute name'),
            }
          : value,
  }
}

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

// Settings initialized via the display snapshot passed to `view.showTrack`.
// Keys that are config slots (`height`, `color`, `sortedBy`, …) are routed by
// `showTrackGeneric` onto the display's config; any remaining plain MST props
// stay on the display instance. SnapshotIn can't be derived from these
// deeply-composed models, so the accepted keys are enumerated here.
// A display's `color` object as the modifiers write it.
interface ColorObject {
  field?: string
  domain?: string[]
  range?: string[]
  scheme?: string
}

interface DisplaySnapshot {
  // common
  height?: number
  // config slot on baseLinearDisplayConfigSchema: render regardless of the
  // region-size / feature-density gate, the declarative equivalent of the
  // banner's "Force load" button
  forceLoad?: boolean
  // alignments + the canvas-based displays (feature, variant), which share
  // LinearCanvasBaseDisplay's slots. Which display each key is valid for is
  // pinned by the `on` list of the modifier that writes it, below.
  featureHeight?: number
  displayMode?: 'normal' | 'compact' | 'superCompact'
  heightMode?: HeightMode
  // alignments
  baseColor?: { field: string }
  modifications?: { fillUnmarked?: boolean }
  facet?: string
  sortedBy?: {
    type: string
    pos: number
    refName: string
    assemblyName: string
    tag?: string
  }
  readConnections?: 'off' | 'arc' | 'cloud'
  readConnectionsDown?: boolean
  readConnectionsHeight?: number
  readConnectionsLineWidth?: number
  linkedReads?: 'off' | 'normal'
  showBezierConnections?: boolean
  showSashimiArcs?: boolean
  sashimiArcsMode?: 'up' | 'down' | 'auto'
  showCoverage?: boolean
  showPileup?: boolean
  coverageHeight?: number
  showSoftClipping?: boolean
  showLegend?: boolean
  maxHeight?: number
  minSashimiScore?: number
  sashimiArcsHeight?: number
  arcColor?: string
  // Lifted back out by `applyDisplayOpts` rather than passed to showTrack —
  // see there for why this one slot cannot ride in on the snapshot.
  filterBy?: FilterBySnapshot
  // every display but hic
  color?: string | ColorObject
  // wiggle / score
  scales?: {
    y: {
      type?: string
      domainMin?: number
      domainMax?: number
      autoscale?: string
    }
  }
  displayCrossHatches?: boolean
  defaultRendering?: string
  resolution?: number
  // multi-sample variants: equal-width columns rather than genomic spans
  variantLayout?: 'genomic' | 'columns'
}

// Compile-time guard that every DisplaySnapshot key actually exists on one of
// the display models. SnapshotIn can't be derived from these
// `_OverrideProps`-composed models, but their Instance types resolve, so we
// check key existence against those: a property renamed or removed upstream (the
// silently-dead-snapshot-field class of bug) then fails the build. It checks
// existence, not snapshot-input validity or value type — value types are pinned
// by the interface above, and WHICH display a key is valid for is pinned by each
// modifier's `on` list.
// Valid keys = every member of the display Instance types (MST props + resolved
// getters) plus the wiggle config slots whose snapshot name diverges from any
// instance member: `autoscale`/`defaultRendering` resolve through
// divergently-named getters (`autoscaleType`/`renderingType`), and
// `color`/`scales` are config-slot-only with no getter —
// `showTrackGeneric` routes all four onto the config, so `keyof` the instance
// misses them. `height` resolves fine — it's the getter.
type WiggleConfigSlotKey = 'defaultRendering' | 'color' | 'scales'
// `forceLoad` is a base-linear-display config slot read through the
// divergently-named `configForceLoad` getter, so `keyof` the instance misses it
// the same way it misses the wiggle slots above.
type BaseConfigSlotKey = 'forceLoad'
// `modifications`, `baseColor` and `arcColor` are alignments config slots read
// through the divergently-named `modificationSettings`, `baseLayer` and
// `arcColorField` getters.
type AlignmentsConfigSlotKey = 'modifications' | 'baseColor' | 'arcColor'
type DisplayKeys =
  | keyof LinearAlignmentsDisplayModel
  | keyof LinearBasicDisplayModel
  | keyof LinearVariantDisplayModel
  | keyof LinearMultiSampleVariantDisplayModel
  | keyof LinearHicDisplayModel
  | keyof WiggleDisplayModel
  | WiggleConfigSlotKey
  | BaseConfigSlotKey
  | AlignmentsConfigSlotKey

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

// The `scales.y` the three score modifiers share, created on first write.
function valueScaleOf(r: BuildResult) {
  r.snap.scales ??= { y: {} }
  return r.snap.scales.y
}

// Friendly aliases for the displays a track type has beyond its default, so the
// CLI doesn't require the full state-model name, with any settings the alias
// implies. `display:<anything-else>` is passed through verbatim.
const displayTypeAliases: Record<
  string,
  { type: string; settings?: DisplaySnapshot }
> = {
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
          r.snap.filterBy = {
            ...r.snap.filterBy,
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
  group: {
    on: ['alignments'],
    apply: (r, v, tag) => {
      const field = parseStr('group', v, 'group field')
      if (field === 'tag') {
        r.snap.facet = `tags.${parseStr('group:tag', tag ?? '', 'tag')}`
      } else {
        r.snap.facet = field
      }
    },
  },
  arcs: {
    on: ['alignments'],
    apply: (r, v) => {
      // A bare `arcs` used to mean OFF, the opposite of every other bare
      // modifier (`coverage`, `force`, …), so the mode is required.
      const mode = parseEnum('arcs', v, ['off', 'up', 'down', 'cloud'] as const)
      r.snap.readConnections = mode === 'cloud' || mode === 'off' ? mode : 'arc'
      if (mode === 'up' || mode === 'down') {
        r.snap.readConnectionsDown = mode === 'down'
      }
    },
  },
  linkedReads: {
    on: ['alignments'],
    apply: (r, v) => {
      // 'bezier' is the separate showBezierConnections overlay, not a
      // linkedReads layout mode (which is only off|normal).
      const mode = parseEnum('linkedReads', v, ['off', 'normal', 'bezier'])
      if (mode === 'bezier') {
        r.snap.showBezierConnections = true
      } else {
        r.snap.linkedReads = mode
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
  coverage: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.showCoverage = parseBool('coverage', v)
    },
  },
  coverageHeight: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.coverageHeight = parseNum('coverageHeight', v)
    },
  },
  readConnectionsHeight: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.readConnectionsHeight = parseNum('readConnectionsHeight', v)
    },
  },
  readConnectionsLineWidth: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.readConnectionsLineWidth = parseNum('readConnectionsLineWidth', v)
    },
  },
  softClipping: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.showSoftClipping = parseBool('softClipping', v)
    },
  },
  // The color key. Off by default in the app because a reader can open the
  // track menu, which is exactly what nobody looking at a PNG can do — same
  // argument as `force`, and the reason a modification or MAPQ export is close
  // to unreadable without it.
  legend: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.showLegend = parseBool('legend', v)
    },
  },
  maxHeight: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.maxHeight = parseNum('maxHeight', v)
    },
  },
  // Sashimi band controls. `sashimiScore` is the junction-support floor, which
  // is what separates real splice junctions from one-read aligner noise, and
  // there is no way to raise it after the fact in a static image.
  sashimiScore: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.minSashimiScore = parseNum('sashimiScore', v)
    },
  },
  sashimiHeight: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.sashimiArcsHeight = parseNum('sashimiHeight', v)
    },
  },
  arcColor: {
    on: ['alignments'],
    apply: (r, v) => {
      r.snap.arcColor = parseEnum('arcColor', v, [
        'insertSizeAndOrientation',
        'insertSize',
        'pairOrientation',
      ] as const)
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
      r.snap.filterBy = {
        ...r.snap.filterBy,
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
      r.snap.filterBy = {
        ...r.snap.filterBy,
        tagFilters: [
          ...(r.snap.filterBy?.tagFilters ?? []),
          {
            tag: parseStr('filterTag', tag, 'a SAM tag name'),
            value: value ?? '',
          },
        ],
      }
    },
  },
  // snpcov collapses an alignments display to coverage-only: hide the pileup
  // band, keep coverage. Sizing the coverage band to the track height (when a
  // height was given) makes it fill the track. Deferred to last by
  // buildDisplaySnapshot so the user's height: flows in first.
  snpcov: {
    on: ['alignments'],
    apply: r => {
      r.snap.showPileup = false
      r.snap.showCoverage = true
      if (r.snap.height !== undefined) {
        r.snap.coverageHeight = r.snap.height
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
  // `color:` asks the same question of every track type, but each display
  // answers it through a different slot, so this routes rather than writing one
  // key. Alignments and the canvas-based displays name a field; wiggle takes a
  // color string. The named modes line up across track types: `color:strand`
  // colors by strand everywhere it applies, `color:tag:X` names a read tag the
  // way `group:tag:X` does, and `color:attribute:X` is the canvas analogue.
  color: {
    on: ALL,
    apply: (r, v, arg, category) => {
      const value = parseStr('color', v, 'color scheme or CSS color')
      if (category === 'alignments') {
        if (BASE_COLOR_NAMES.has(value)) {
          invalid('color', value, `a read field; baseColor:${value} draws it`)
        } else if (value === 'tag') {
          mergeColor(r, {
            field: `tags.${parseStr('color:tag', arg ?? '', 'tag')}`,
          })
        } else if (ALIGNMENTS_COLOR_FIELDS.has(value)) {
          mergeColor(r, { field: value })
        } else {
          r.snap.color = value
        }
      } else if (category === 'hic') {
        if (!(COLOR_SCHEMES as readonly string[]).includes(value)) {
          invalid(
            'color',
            value,
            `a colour scheme: ${COLOR_SCHEMES.join(', ')}`,
          )
        }
        mergeColor(r, { scheme: value })
      } else if (category === 'wiggle') {
        // A string on the quantitative display's colour object is the
        // constant, so this is the whole of "render in one solid color".
        r.snap.color = value
      } else {
        // Feature/variant: LinearCanvasBaseDisplay's `color`. A
        // jexl with more than one colon can't survive this modifier's
        // `split(':')`, so it goes through the JSON escape hatch.
        const { color } = canvasColor(value, arg)
        if (typeof color === 'object') {
          mergeColor(r, color)
        } else {
          r.snap.color = color
        }
      }
    },
  },

  // ——— wiggle / score ———
  //
  // These three are `alignments` as well as `wiggle`, and it is the same object
  // in both cases rather than a translation: LinearAlignmentsDisplay's coverage
  // band carries the same `scales.y`. Restricting them to wiggle left an RNA-seq
  // coverage band no way to ask for a log axis from the CLI, which is exactly
  // where one is wanted: junction depth spans two orders of magnitude, so a
  // linear axis puts the whole picture in the first exon.
  //
  // Three modifiers write one sub-schema, so each merges into what the others
  // put there; `applyDisplaySettings` merges the object onto the display's own
  // defaults in turn, so a bag naming one member leaves the rest alone.
  autoscale: {
    on: ['wiggle', 'alignments'],
    apply: (r, v) => {
      valueScaleOf(r).autoscale = parseStr('autoscale', v, 'autoscale type')
    },
  },
  minmax: {
    on: ['wiggle', 'alignments'],
    apply: (r, min, max) => {
      if (min) {
        valueScaleOf(r).domainMin = parseNum('minmax', min)
      }
      if (max) {
        valueScaleOf(r).domainMax = parseNum('minmax', max)
      }
    },
  },
  // scaletype/autoscale name a member's enum value directly. They are NOT
  // re-listed here: the member's own stringEnum rejects a bad value, which
  // reaches jb2export as a fatal render error, so a local copy of the list would
  // only add a way for the CLI to drift out of step with the display.
  scaletype: {
    on: ['wiggle', 'alignments'],
    apply: (r, v) => {
      valueScaleOf(r).type = parseStr('scaletype', v, 'linear or log')
    },
  },
  crosshatch: {
    on: ['wiggle'],
    apply: (r, v) => {
      r.snap.displayCrossHatches = parseBool('crosshatch', v)
    },
  },
  // Legacy fill toggle. `fill:false` historically meant "no fill" on
  // xyplot-family renderers, which maps to the `scatter` rendering type;
  // `fill:true` is plain `xyplot`.
  fill: {
    on: ['wiggle'],
    apply: (r, v) => {
      r.snap.defaultRendering = parseBool('fill', v) ? 'xyplot' : 'scatter'
    },
  },
  resolution: {
    on: ['wiggle'],
    apply: (r, v) => {
      r.snap.resolution =
        v === 'fine'
          ? 10
          : v === 'superfine'
            ? 100
            : parseNum('resolution', v, 'fine, superfine, or a number')
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
      `Warning: track option "${prefix}" has no effect on a ${category} track (applies to: ${modifier.on.join(', ')})`,
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

// Parse a track's modifier list into a declarative display snapshot. snpcov is
// applied last because it reads the resolved height. Pure (no view/display), so
// it's unit-testable; the center-line sort is returned as an intent for the
// caller to resolve against the view. A member write is `writeMembers`'s.
export function buildDisplaySnapshot(category: Category, opts: string[]) {
  const result: BuildResult = { snap: {} }
  const deferred: [string, string, string | undefined][] = []
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      mergeSettings(
        settingsOf(result),
        settingsOf({ snap: parseJsonModifier(opt) }),
      )
      continue
    }
    if (isSlotPathOption(opt)) {
      if (!isMemberWrite(opt)) {
        mergeSettings(settingsOf(result), slotPathSettings(opt))
      }
      continue
    }
    const [prefix = '', val1 = '', val2] = opt.split(':')
    if (prefix === 'snpcov') {
      deferred.push([prefix, val1, val2])
    } else {
      applyModifier(result, category, prefix, val1, val2)
    }
  }
  for (const [prefix, val1, val2] of deferred) {
    applyModifier(result, category, prefix, val1, val2)
  }
  return result
}

// Open a track already known to the view's config (a `--bam` file whose adapter
// was built into the config, or a hosted `--track <id>`) with its display in the
// requested state. `trackId` is the exact id; `category` selects which modifiers
// apply. Shared by applyTrackOpts and the --track path.
export async function applyDisplayOpts(
  view: LinearGenomeViewModel,
  trackId: string,
  category: Category,
  opts: string[],
) {
  const { snap, sort, displayType } = buildDisplaySnapshot(category, opts)

  // Resolve the center-line sort against the view (the pivot is the genomic
  // position under the view center) and bake it into the snapshot. The view only
  // has a center line once it has displayed regions, so say when the sort is
  // dropped rather than render an unsorted pileup that looks like a sort bug.
  if (sort) {
    const center = view.centerLineInfo
    if (center && center.offset >= 0) {
      snap.sortedBy = {
        type: sort.type,
        pos: Math.round(center.offset),
        refName: center.refName,
        assemblyName: center.assemblyName,
        tag: sort.tag,
      }
    } else {
      console.warn(
        `Warning: sort:${sort.type} on "${trackId}" ignored — the view has no center position to sort at (pass --loc)`,
      )
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
  const { filterBy, ...displaySnap } = snap

  // Create the display already in its target state rather than mutating a
  // default display with setter actions. An explicit `display:` selects a
  // non-default display via the snapshot `type` launchTrack reads.
  const opened = await view.launchTrack(
    trackId,
    {},
    displayType ? { ...displaySnap, type: displayType } : displaySnap,
  )
  // launchTrack returns undefined on any failure (invalid track config, or a
  // display: type that doesn't exist for this track) — surface a clear message
  // instead of a downstream "cannot read 'displays' of undefined".
  if (!opened) {
    throw new Error(
      `Failed to open track "${trackId}"${displayType ? ` with display "${displayType}"` : ''}`,
    )
  }
  if (filterBy) {
    const display = opened.displays[0] as
      | { filterBy?: FilterBySnapshot; setFilterBy?: (f: unknown) => void }
      | undefined
    if (display?.setFilterBy) {
      const { tagFilters, ...rest } = filterBy
      display.setFilterBy({
        ...display.filterBy,
        ...rest,
        // AND-ed, like every other tag filter: a `filterTag:` on the command
        // line adds a condition to the track's own rather than replacing it.
        ...(tagFilters
          ? {
              tagFilters: [
                ...(display.filterBy?.tagFilters ?? []),
                ...tagFilters,
              ],
            }
          : {}),
      })
    } else {
      console.warn(
        `Warning: filter options on "${trackId}" ignored — its display has no filterBy`,
      )
    }
  }
  writeMembers(view, trackId, opts)
}

/**
 * Write a track's `color.field=…` modifiers onto what its display in `view`
 * already has, after every other modifier, so a member write keeps the rest
 * of the setting whatever order the command line gives them in. A display
 * replaces a colour or facet object whole, the way a session spec writes one,
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
    const configured: Record<string, unknown> = getSnapshot(
      track.activeDisplay.configuration,
    )
    const writes = members.map(slotPathSettings)
    const written = new Set(writes.flatMap(write => Object.keys(write)))
    view.showTrack(
      trackId,
      {},
      writes.reduce(
        mergeSettings,
        structuredClone(
          Object.fromEntries(
            Object.entries(configured).filter(([key]) => written.has(key)),
          ),
        ),
      ),
    )
  }
}
