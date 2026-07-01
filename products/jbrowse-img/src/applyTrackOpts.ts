import path from 'path'

import { booleanize } from './util.ts'

import type { Entry } from './parseArgv.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-canvas'
import type { LinearHicDisplayModel } from '@jbrowse/plugin-hic'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { LinearVariantDisplayModel } from '@jbrowse/plugin-variants'
import type { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

type WiggleDisplayModel = Instance<
  ReturnType<typeof linearWiggleDisplayModelFactory>
>

// The concrete display models jb2export can drive (one per supported track
// type). Typing this union — rather than the loose
// `view.tracks[number].displays[number]`, whose pluggable element type permits
// any property access — is what lets tsgo catch a residual action call to a
// method that exists on no display (e.g. a renamed setFeatureDensityStatsLimit).
export type TrackDisplay =
  | LinearAlignmentsDisplayModel
  | LinearBasicDisplayModel
  | LinearVariantDisplayModel
  | LinearHicDisplayModel
  | WiggleDisplayModel

// Display category, derived from the CLI track-type flag (--bam, --bigwig, …).
// Lets us build the right snapshot before the display instance exists, and gate
// each modifier to the track types it applies to.
export type Category = 'alignments' | 'wiggle' | 'feature' | 'variant' | 'hic'

const categoryByType: Record<string, Category> = {
  bam: 'alignments',
  cram: 'alignments',
  bigwig: 'wiggle',
  vcfgz: 'variant',
  gffgz: 'feature',
  bigbed: 'feature',
  bedgz: 'feature',
  hic: 'hic',
}

// Per-read height/spacing for the alignments compactness presets. Mirrors
// COMPACTNESS_PRESETS in plugin-alignments (kept local to avoid a cross-plugin
// value import for two stable numbers); the canvas feature display expresses the
// same idea through its `displayMode` config slot instead.
const ALIGNMENTS_COMPACTNESS = {
  normal: { featureHeight: 7, featureSpacing: 1 },
  compact: { featureHeight: 3, featureSpacing: 0 },
  'super-compact': { featureHeight: 1, featureSpacing: 0 },
}

// Settings initialized via the display snapshot passed to `view.showTrack`.
// Keys that are config slots (`height`, `color`, `sortedBy`, …) are routed by
// `showTrackGeneric` onto the display's config; any remaining plain MST props
// stay on the display instance. SnapshotIn can't be derived from these
// deeply-composed models, so the accepted keys are enumerated here.
interface DisplaySnapshot {
  // common
  height?: number
  // alignments + feature
  colorBy?: { type: string; tag?: string }
  featureHeight?: number
  featureSpacing?: number
  // feature (canvas)
  displayMode?: 'normal' | 'compact' | 'superCompact'
  // alignments
  groupBy?: { type: string; tag?: string }
  sortedBy?: {
    type: string
    pos: number
    refName: string
    assemblyName: string
    tag?: string
  }
  readConnections?: 'off' | 'arc' | 'samplot'
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
// by the interface above.
// Valid keys = every member of the display Instance types (MST props + resolved
// getters) plus the wiggle config slots whose snapshot name diverges from any
// instance member: `autoscale`/`defaultRendering` resolve through
// divergently-named getters (`autoscaleType`/`renderingType`), and
// `color`/`useBicolor` are config-slot-only with no getter — `showTrackGeneric`
// routes all four onto the config, so `keyof` the instance misses them. `height`
// resolves fine — it's the getter.
type WiggleConfigSlotKey = 'autoscale' | 'defaultRendering' | 'color' | 'useBicolor'
type DisplayKeys =
  | keyof LinearAlignmentsDisplayModel
  | keyof LinearBasicDisplayModel
  | keyof LinearVariantDisplayModel
  | keyof LinearHicDisplayModel
  | keyof WiggleDisplayModel
  | WiggleConfigSlotKey

type AssertNever<T extends never> = T
export type UnknownSnapshotKeys = Exclude<keyof DisplaySnapshot, DisplayKeys>
export type AssertSnapshotKeysExist = AssertNever<UnknownSnapshotKeys>

// The center-line sort is the one setting that depends on view state (the sort
// pivot is the genomic position under the view center), so it's parsed into this
// intent and resolved against the view before the snapshot is built.
interface BuildResult {
  snap: DisplaySnapshot
  sort?: { type: string; tag?: string }
  // `force` flips a volatile load-gate (no snapshot representation), so it stays
  // an action on the created display.
  force: boolean
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

// Fold one `prefix:val1:val2` modifier into the display snapshot. Gated by
// category so a modifier only writes keys valid for that display type (an
// out-of-category key would be an invalid snapshot).
function applyModifier(
  result: BuildResult,
  category: Category,
  prefix: string,
  val1: string,
  val2: string | undefined,
) {
  const snap = result.snap
  const isAlignments = category === 'alignments'
  const isScore = category === 'wiggle'
  const hasFeatureSize = isAlignments || category === 'feature'
  switch (prefix) {
    case 'height': {
      if (val1) {
        snap.height = +val1
      }
      break
    }
    case 'sort': {
      if (isAlignments) {
        result.sort = { type: val1, tag: val2 }
      }
      break
    }
    case 'group': {
      if (isAlignments && val1) {
        snap.groupBy = { type: val1, tag: val2 }
      }
      break
    }
    case 'color': {
      if (isAlignments || category === 'variant' || category === 'feature') {
        snap.colorBy = { type: val1, tag: val2 }
      } else if (isScore) {
        // Wiggle: render in one solid color. The bicolor default routes through
        // pos/negColor and ignores `color`, so turn it off to honor the request.
        snap.color = val1
        snap.useBicolor = false
      }
      break
    }
    case 'arcs': {
      if (isAlignments) {
        if (val1 === 'samplot') {
          snap.readConnections = 'samplot'
        } else if (val1 === 'up' || val1 === 'down') {
          snap.readConnections = 'arc'
          snap.readConnectionsDown = val1 === 'down'
        } else {
          snap.readConnections = 'off'
        }
      }
      break
    }
    case 'linkedReads': {
      if (isAlignments) {
        // 'bezier' is the separate showBezierConnections overlay, not a
        // linkedReads layout mode (which is only off|normal).
        if (val1 === 'bezier') {
          snap.showBezierConnections = true
        } else if (val1 === 'normal' || val1 === 'off') {
          snap.linkedReads = val1
        }
      }
      break
    }
    case 'sashimi': {
      if (isAlignments) {
        if (val1 === 'off') {
          snap.showSashimiArcs = false
        } else if (val1 === 'up' || val1 === 'down' || val1 === 'auto') {
          snap.showSashimiArcs = true
          snap.sashimiArcsMode = val1
        }
      }
      break
    }
    case 'coverage': {
      if (isAlignments) {
        snap.showCoverage = booleanize(val1 || 'true')
      }
      break
    }
    case 'coverageHeight': {
      if (isAlignments && val1) {
        snap.coverageHeight = +val1
      }
      break
    }
    case 'readConnectionsHeight': {
      if (isAlignments && val1) {
        snap.readConnectionsHeight = +val1
      }
      break
    }
    case 'readConnectionsLineWidth': {
      if (isAlignments && val1) {
        snap.readConnectionsLineWidth = +val1
      }
      break
    }
    case 'featureHeight': {
      if (val1 === 'normal' || val1 === 'compact' || val1 === 'super-compact') {
        // The compactness presets map onto different fields per display:
        // featureHeight/spacing for alignments, the displayMode slot for canvas
        // features. Both are still plain snapshot values.
        if (isAlignments) {
          const { featureHeight, featureSpacing } = ALIGNMENTS_COMPACTNESS[val1]
          snap.featureHeight = featureHeight
          snap.featureSpacing = featureSpacing
        } else if (category === 'feature') {
          snap.displayMode = val1 === 'super-compact' ? 'superCompact' : val1
        }
      } else if (val1 && hasFeatureSize) {
        const n = +val1
        if (isNaN(n)) {
          throw new Error(
            `Invalid featureHeight "${val1}". Use normal, compact, super-compact, or a number.`,
          )
        }
        snap.featureHeight = n
      }
      break
    }
    case 'featureSpacing': {
      if (val1 && hasFeatureSize) {
        snap.featureSpacing = +val1
      }
      break
    }
    case 'noSpacing': {
      // Legacy boolean: true → 0px spacing, false → 2px spacing (the value the
      // pre-unification override branch baked in for noSpacing=false).
      if (hasFeatureSize) {
        snap.featureSpacing = booleanize(val1 || 'true') ? 0 : 2
      }
      break
    }
    case 'softClipping': {
      if (isAlignments) {
        snap.showSoftClipping = booleanize(val1 || 'true')
      }
      break
    }
    case 'force': {
      if (booleanize(val1 || 'true')) {
        result.force = true
      }
      break
    }
    case 'display': {
      if (val1) {
        result.displayType = displayTypeAliases[val1] ?? val1
      }
      break
    }
    case 'autoscale': {
      if (isScore) {
        snap.autoscale = val1
      }
      break
    }
    case 'minmax': {
      if (isScore) {
        if (val1) {
          snap.minScore = +val1
        }
        if (val2) {
          snap.maxScore = +val2
        }
      }
      break
    }
    case 'scaletype': {
      if (isScore) {
        snap.scaleType = val1
      }
      break
    }
    case 'crosshatch': {
      if (isScore) {
        snap.displayCrossHatches = booleanize(val1 || 'true')
      }
      break
    }
    // Legacy fill toggle. `fill:false` historically meant "no fill" on
    // xyplot-family renderers, which the wiggle migration maps to the `scatter`
    // rendering type (see migrateWiggleSnapshot); `fill:true` is plain `xyplot`.
    case 'fill': {
      if (isScore) {
        snap.defaultRendering = booleanize(val1 || 'true')
          ? 'xyplot'
          : 'scatter'
      }
      break
    }
    case 'resolution': {
      if (isScore) {
        const val =
          val1 === 'fine' ? 10 : val1 === 'superfine' ? 100 : Number(val1)
        snap.resolution = Number.isNaN(val) ? 1 : val
      }
      break
    }
    // snpcov collapses an alignments display to coverage-only: hide the pileup
    // band, keep coverage. Sizing the coverage band to the track height (when a
    // height was given) makes it fill the track. Applied after the loop so the
    // user's height: flows in first.
    case 'snpcov': {
      if (isAlignments) {
        snap.showPileup = false
        snap.showCoverage = true
        if (snap.height !== undefined) {
          snap.coverageHeight = snap.height
        }
      }
      break
    }
    default: {
      console.warn(`Warning: unknown track option "${prefix}"`)
      break
    }
  }
}

// Parse a track's modifier list into a declarative display snapshot. snpcov is
// applied last because it reads the resolved height. Pure (no view/display), so
// it's unit-testable; the center-line sort is returned as an intent for the
// caller to resolve against the view.
export function buildDisplaySnapshot(category: Category, opts: string[]) {
  const result: BuildResult = { snap: {}, force: false }
  const deferred: string[] = []
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      // Raw JSON escape hatch for settings without a dedicated modifier.
      Object.assign(result.snap, JSON.parse(opt) as DisplaySnapshot)
    } else if (opt.startsWith('snpcov')) {
      deferred.push(opt)
    } else {
      const [prefix = '', val1 = '', val2] = opt.split(':')
      applyModifier(result, category, prefix, val1, val2)
    }
  }
  for (const opt of deferred) {
    const [prefix = '', val1 = '', val2] = opt.split(':')
    applyModifier(result, category, prefix, val1, val2)
  }
  return result
}

export function applyTrackOpts(trackEntry: Entry, view: LinearGenomeViewModel) {
  const [trackType, [track, ...opts]] = trackEntry
  if (!track) {
    throw new Error('invalid command line args')
  }
  const category = categoryByType[trackType] ?? 'feature'
  const { snap, sort, force, displayType } = buildDisplaySnapshot(
    category,
    opts,
  )

  // Resolve the center-line sort against the view (the pivot is the genomic
  // position under the view center) and bake it into the snapshot.
  const center = view.centerLineInfo
  if (sort && center && center.offset >= 0) {
    snap.sortedBy = {
      type: sort.type,
      pos: Math.round(center.offset),
      refName: center.refName,
      assemblyName: center.assemblyName,
      tag: sort.tag,
    }
  }

  // Create the display already in its target state rather than mutating a
  // default display with setter actions. An explicit `display:` selects a
  // non-default display via the snapshot `type` showTrack reads.
  const opened = view.showTrack(
    path.basename(track),
    {},
    displayType ? { ...snap, type: displayType } : snap,
  )
  // showTrack returns undefined on any failure (invalid track config, or a
  // display: type that doesn't exist for this track) — surface a clear message
  // instead of a downstream "cannot read 'displays' of undefined".
  if (!opened) {
    throw new Error(
      `Failed to open track "${track}"${displayType ? ` with display "${displayType}"` : ''}`,
    )
  }
  const display = opened.displays[0] as TrackDisplay

  // `force` is the lone non-snapshot setting: it flips a volatile load-gate.
  // (every display in the union implements setFeatureDensityStatsLimit, so no
  // optional chain is needed here — unlike the display-specific actions above.)
  if (force) {
    display.setFeatureDensityStatsLimit({ bytes: Number.MAX_VALUE })
  }
}
