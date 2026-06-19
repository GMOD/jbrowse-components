import path from 'path'

import { applySnapshot, getSnapshot } from '@jbrowse/mobx-state-tree'

import { booleanize } from './util.ts'

import type { Entry } from './parseArgv.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type TrackDisplay =
  LinearGenomeViewModel['tracks'][number]['displays'][number]

// Score/scale/color settings for wiggle-family displays are stored as flat
// config-override keys on the display snapshot (ConfigOverrideMixin serializes
// them flat), so we specify them declaratively as a snapshot patch and apply it
// in one applySnapshot. This is sturdier than per-setting actions, whose names
// drift as the GPU-migrated display models evolve (e.g. the old setFill /
// setCrossHatches actions no longer exist).
export type SnapshotPatch = Record<string, unknown>

// Apply a single `prefix:val1:val2` track modifier. Action-style modifiers
// (sort, grouping, arcs, …) dispatch immediately; declarative score-display
// settings accumulate into `patch`, which the caller applies once at the end.
export function applyTrackModifier(
  display: TrackDisplay,
  prefix: string,
  val1: string,
  val2: string | undefined,
  patch: SnapshotPatch = {},
) {
  // Wiggle/quantitative displays expose setScaleType; gate score-only settings
  // on it so they no-op (rather than corrupt the snapshot) on other displays.
  const isScoreDisplay = typeof display.setScaleType === 'function'
  switch (prefix) {
    case 'height': {
      if (val1) {
        display.setHeight(+val1)
      }
      break
    }
    case 'sort': {
      display.setSortedBy?.(val1, val2)
      break
    }
    // type:tag — in-track stacked grouping (strand, tag:HP, pairOrientation,
    // supplementary, duplicate, mapq, …). Empty value clears grouping.
    case 'group': {
      display.setGroupBy?.(val1 ? { type: val1, tag: val2 } : undefined)
      break
    }
    case 'color': {
      if (display.setColorScheme) {
        display.setColorScheme({ type: val1, tag: val2 })
      } else if (isScoreDisplay) {
        // Wiggle: render in one solid color. The bicolor default routes through
        // pos/negColor and ignores `color`, so turn it off to honor the request.
        patch.color = val1
        patch.useBicolor = false
      }
      break
    }
    // 'off' | 'up' | 'down' | 'samplot' — paired-end connections. Mode and
    // direction are separate model fields; translate the legacy flag value.
    case 'arcs': {
      if (val1 === 'samplot') {
        display.setReadConnections?.('samplot')
      } else if (val1 === 'up' || val1 === 'down') {
        display.setReadConnections?.('arc')
        display.setReadConnectionsDown?.(val1 === 'down')
      } else {
        display.setReadConnections?.('off')
      }
      break
    }
    // 'off' | 'normal' | 'bezier' — 10x/linked-read chain overlay
    case 'linkedReads': {
      display.setLinkedReads?.(val1)
      break
    }
    // 'off' | 'up' | 'down' — splice-junction arcs
    case 'sashimi': {
      display.setSashimiArcs?.(val1)
      break
    }
    case 'coverage': {
      display.setShowCoverage?.(booleanize(val1 || 'true'))
      break
    }
    case 'coverageHeight': {
      if (val1) {
        display.setCoverageHeight?.(+val1)
      }
      break
    }
    case 'readConnectionsHeight': {
      if (val1) {
        display.setReadConnectionsHeight?.(+val1)
      }
      break
    }
    case 'readConnectionsLineWidth': {
      if (val1) {
        display.setReadConnectionsLineWidth?.(+val1)
      }
      break
    }
    case 'featureHeight': {
      if (['normal', 'compact', 'super-compact'].includes(val1)) {
        // setCompactness is the authoritative cross-display API (alignments,
        // basic features, comparative views all implement it)
        display.setCompactness?.(val1)
      } else if (val1) {
        const n = +val1
        if (isNaN(n)) {
          throw new Error(
            `Invalid featureHeight "${val1}". Use normal, compact, super-compact, or a number.`,
          )
        }
        display.setFeatureHeight?.(n)
      }
      break
    }
    case 'featureSpacing': {
      if (val1) {
        display.setFeatureSpacing?.(+val1)
      }
      break
    }
    case 'noSpacing': {
      // Legacy boolean: true → 0px spacing, false → 2px spacing (the value the
      // pre-unification override branch baked in for noSpacing=false).
      display.setFeatureSpacing?.(booleanize(val1 || 'true') ? 0 : 2)
      break
    }
    case 'softClipping': {
      if (booleanize(val1 || 'true') !== display.showSoftClipping) {
        display.toggleSoftClipping?.()
      }
      break
    }
    case 'force': {
      if (booleanize(val1 || 'true')) {
        display.setFeatureDensityStatsLimit({ bytes: Number.MAX_VALUE })
      }
      break
    }
    case 'autoscale': {
      if (isScoreDisplay) {
        patch.autoscale = val1
      }
      break
    }
    case 'minmax': {
      if (isScoreDisplay) {
        if (val1) {
          patch.minScore = +val1
        }
        if (val2) {
          patch.maxScore = +val2
        }
      }
      break
    }
    case 'scaletype': {
      if (isScoreDisplay) {
        patch.scaleType = val1
      }
      break
    }
    case 'crosshatch': {
      if (isScoreDisplay) {
        patch.displayCrossHatches = booleanize(val1 || 'true')
      }
      break
    }
    // Legacy fill toggle. `fill:false` historically meant "no fill" on
    // xyplot-family renderers, which the wiggle migration maps to the `scatter`
    // rendering type (see migrateWiggleSnapshot); `fill:true` is plain `xyplot`.
    case 'fill': {
      if (isScoreDisplay) {
        patch.defaultRendering = booleanize(val1 || 'true')
          ? 'xyplot'
          : 'scatter'
      }
      break
    }
    case 'resolution': {
      if (isScoreDisplay) {
        const val =
          val1 === 'fine' ? 10 : val1 === 'superfine' ? 100 : Number(val1)
        patch.resolution = Number.isNaN(val) ? 1 : val
      }
      break
    }
    // 'snpcov' is applied after the modifier loop (see applyCoverageOnly), so
    // it's a no-op here rather than an unknown-option warning.
    case 'snpcov': {
      break
    }
    default: {
      console.warn(`Warning: unknown track option "${prefix}"`)
      break
    }
  }
}

// snpcov is a "show only coverage" pseudo-mode. The unified
// LinearAlignmentsDisplay has no explicit coverage-only flag — pileup viewport
// height = display.height - coverageHeight, so we make coverage fill the whole
// track. Applied after the modifier loop so the user's height:/coverageHeight:
// settings flow through first.
export function applyCoverageOnly(display: TrackDisplay, opts: string[]) {
  if (opts.includes('snpcov') && display.setCoverageHeight && display.height) {
    display.setShowCoverage?.(true)
    display.setCoverageHeight(display.height)
  }
}

export function applyTrackOpts(trackEntry: Entry, view: LinearGenomeViewModel) {
  const [, [track, ...opts]] = trackEntry
  if (!track) {
    throw new Error('invalid command line args')
  }
  const display = view.showTrack(path.basename(track)).displays[0]

  // Accumulate declarative snapshot settings (score-display config + any `{...}`
  // JSON escape-hatch overrides) and apply them in one merge after the loop, so
  // action-style modifiers and config settings can be freely interleaved.
  const patch: SnapshotPatch = {}
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      Object.assign(patch, JSON.parse(opt) as SnapshotPatch)
    } else {
      const [prefix = '', val1 = '', val2] = opt.split(':')
      applyTrackModifier(display, prefix, val1, val2, patch)
    }
  }
  if (Object.keys(patch).length > 0) {
    const current: Record<string, unknown> = getSnapshot(display)
    applySnapshot(display, { ...current, ...patch })
  }

  applyCoverageOnly(display, opts)
}
