import { trackMatches, trackName } from './trackFields.ts'

import type { AssertNever, AssertTrue, Covers, Track } from './types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-canvas'
import type { LinearHicDisplayModel } from '@jbrowse/plugin-hic'
import type {
  HeightMode,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { LinearVariantDisplayModel } from '@jbrowse/plugin-variants'
import type { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

type WiggleDisplayModel = Instance<
  ReturnType<typeof linearWiggleDisplayModelFactory>
>

// The concrete display models jb2export can drive (one per supported track
// type). Typing this union — rather than the loose
// `view.tracks[number].displays[number]`, whose pluggable element type permits
// any property access — is what lets tsc catch a residual action call to a
// method that exists on no display (e.g. a renamed raiseForceLoadLimits).
export type TrackDisplay =
  | LinearAlignmentsDisplayModel
  | LinearBasicDisplayModel
  | LinearVariantDisplayModel
  | LinearHicDisplayModel
  | WiggleDisplayModel

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
// from the height in the display, not stored). Mirrors COMPACTNESS_PRESETS in
// plugin-alignments (kept local to avoid a cross-plugin value import for three
// stable numbers); the canvas feature display expresses the same idea through
// its `displayMode` config slot instead.
const ALIGNMENTS_COMPACTNESS = {
  normal: 7,
  compact: 3,
  'super-compact': 1,
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
  colorBy?: { type: string; tag?: string }
  groupBy?: { type: string; tag?: string }
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
  // wiggle / score
  color?: string
  useBicolor?: boolean
  autoscale?: string
  minScore?: number
  maxScore?: number
  scaleType?: string
  displayCrossHatches?: boolean
  defaultRendering?: string
  resolution?: number
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
// `color`/`useBicolor` are config-slot-only with no getter — `showTrackGeneric`
// routes all four onto the config, so `keyof` the instance misses them. `height`
// resolves fine — it's the getter.
type WiggleConfigSlotKey =
  | 'autoscale'
  | 'defaultRendering'
  | 'color'
  | 'useBicolor'
// `forceLoad` is a base-linear-display config slot read through the
// divergently-named `configForceLoad` getter, so `keyof` the instance misses it
// the same way it misses the wiggle slots above.
type BaseConfigSlotKey = 'forceLoad'
type DisplayKeys =
  | keyof LinearAlignmentsDisplayModel
  | keyof LinearBasicDisplayModel
  | keyof LinearVariantDisplayModel
  | keyof LinearHicDisplayModel
  | keyof WiggleDisplayModel
  | WiggleConfigSlotKey
  | BaseConfigSlotKey

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
// CLI doesn't require the full state-model name. `display:<anything-else>` is
// passed through verbatim.
const displayTypeAliases: Record<string, string> = {
  multivariant: 'LinearMultiSampleVariantDisplay',
  multivariantmatrix: 'LinearMultiSampleVariantMatrixDisplay',
}

// The pileup sort types the layout recognizes (`sortLayout.ts`). `base` is the
// intuitive spelling the docs example uses, but the layout keys on `basePair` —
// an unrecognized type sorts nothing silently (it just falls through), so
// normalize the alias here rather than let `sort:base` become a no-op.
const sortTypeAliases: Record<string, string> = {
  base: 'basePair',
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
      r.displayType = displayTypeAliases[name] ?? name
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
      r.sort = { type: sortTypeAliases[type] ?? type, tag }
    },
  },
  group: {
    on: ['alignments'],
    apply: (r, v, tag) => {
      r.snap.groupBy = { type: parseStr('group', v, 'group type'), tag }
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
  // Two different settings share the `color:` spelling because they are the same
  // question per track type: alignments pick a color SCHEME (`colorBy`, which
  // takes an optional tag), wiggle picks a solid CSS color. The canvas-based
  // feature and variant displays have neither slot — a `colorBy` written for
  // them was dropped as an unknown MST key (feature) or rejected as a
  // wrong-shaped config-slot value (the multi-sample variant displays, whose
  // `colorBy` is a plain sample-attribute string), so they are gated out here.
  color: {
    on: ['alignments', 'wiggle'],
    apply: (r, v, tag, category) => {
      const value = parseStr('color', v, 'color scheme or CSS color')
      if (category === 'alignments') {
        r.snap.colorBy = { type: value, tag }
      } else {
        // Wiggle: render in one solid color. The bicolor default routes through
        // pos/negColor and ignores `color`; the display config's own
        // `colorImpliesSolid` preProcessSnapshot turns bicolor off for a bare
        // `color`, so don't restate it here — that would also override an
        // explicit `useBicolor` from the JSON escape hatch.
        r.snap.color = value
      }
    },
  },

  // ——— wiggle / score ———
  autoscale: {
    on: ['wiggle'],
    apply: (r, v) => {
      r.snap.autoscale = parseStr('autoscale', v, 'autoscale type')
    },
  },
  minmax: {
    on: ['wiggle'],
    apply: (r, min, max) => {
      if (min) {
        r.snap.minScore = parseNum('minmax', min)
      }
      if (max) {
        r.snap.maxScore = parseNum('minmax', max)
      }
    },
  },
  // scaletype/autoscale name a wiggle config slot's enum value directly. They
  // are NOT re-listed here: the slot's own stringEnum rejects a bad value, which
  // reaches jb2export as a fatal render error, so a local copy of the list would
  // only add a way for the CLI to drift out of step with the display.
  scaletype: {
    on: ['wiggle'],
    apply: (r, v) => {
      r.snap.scaleType = parseStr('scaletype', v, 'linear or log')
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
  const modifier = modifiers[prefix]
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
// caller to resolve against the view.
export function buildDisplaySnapshot(category: Category, opts: string[]) {
  const result: BuildResult = { snap: {} }
  const deferred: [string, string, string | undefined][] = []
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      Object.assign(result.snap, parseJsonModifier(opt))
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
export function applyDisplayOpts(
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

  // Create the display already in its target state rather than mutating a
  // default display with setter actions. An explicit `display:` selects a
  // non-default display via the snapshot `type` showTrack reads.
  const opened = view.showTrack(
    trackId,
    {},
    displayType ? { ...snap, type: displayType } : snap,
  )
  // showTrack returns undefined on any failure (invalid track config, or a
  // display: type that doesn't exist for this track) — surface a clear message
  // instead of a downstream "cannot read 'displays' of undefined".
  if (!opened) {
    throw new Error(
      `Failed to open track "${trackId}"${displayType ? ` with display "${displayType}"` : ''}`,
    )
  }
}
