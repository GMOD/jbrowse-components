import path from 'path'

import { applySnapshot, getSnapshot } from '@jbrowse/mobx-state-tree'

import { booleanize } from './util.ts'

import type { Entry } from './parseArgv.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type TrackDisplay =
  LinearGenomeViewModel['tracks'][number]['displays'][number]

// Merge a raw JSON object into the display snapshot — an escape hatch (e.g.
// '{"colorBy":{"type":"strand"}}') for any setting with no dedicated modifier.
export function mergeDisplaySnapshot(display: TrackDisplay, json: string) {
  const current: Record<string, unknown> = getSnapshot(display)
  const overrides = JSON.parse(json) as Record<string, unknown>
  applySnapshot(display, { ...current, ...overrides })
}

// Apply a single `prefix:val1:val2` track modifier to a display.
export function applyTrackModifier(
  display: TrackDisplay,
  prefix: string,
  val1: string,
  val2: string | undefined,
) {
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
      } else {
        display.setColor?.(val1)
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
      display.setAutoscale(val1)
      break
    }
    case 'minmax': {
      if (val1) {
        display.setMinScore(+val1)
      }
      if (val2) {
        display.setMaxScore(+val2)
      }
      break
    }
    case 'scaletype': {
      display.setScaleType(val1)
      break
    }
    case 'crosshatch': {
      display.setCrossHatches(booleanize(val1 || 'true'))
      break
    }
    case 'fill': {
      display.setFill(booleanize(val1 || 'true'))
      break
    }
    case 'resolution': {
      const val =
        val1 === 'fine' ? 10 : val1 === 'superfine' ? 100 : Number(val1)
      display.setResolution(Number.isNaN(val) ? 1 : val)
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
  for (const opt of opts) {
    if (opt.startsWith('{')) {
      mergeDisplaySnapshot(display, opt)
    } else {
      const [prefix = '', val1 = '', val2] = opt.split(':')
      applyTrackModifier(display, prefix, val1, val2)
    }
  }
  applyCoverageOnly(display, opts)
}
