import path from 'path'

import { destroy } from '@jbrowse/mobx-state-tree'
import { renderToSvg as renderCircularToSvg } from '@jbrowse/plugin-circular-view'
import { renderToSvg as renderDotplotToSvg } from '@jbrowse/plugin-dotplot-view'
import { renderToSvg as renderSyntenyToSvg } from '@jbrowse/plugin-linear-comparative-view'
import { renderToSvg as renderLinearToSvg } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-app2'
import { createCanvas } from 'canvas'
import { when } from 'mobx'

import { readData } from './readData.ts'
import { booleanize } from './util.ts'

import type { Entry } from './parseArgv.ts'
import type { Config, Opts } from './readData.ts'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'
import type { DotplotViewModel } from '@jbrowse/plugin-dotplot-view'
import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function applyTrackOpts(trackEntry: Entry, view: LinearGenomeViewModel) {
  const [, [track, ...opts]] = trackEntry
  if (!track) {
    throw new Error('invalid command line args')
  }
  const currentTrack = view.showTrack(path.basename(track))
  const display = currentTrack.displays[0]
  for (const opt of opts) {
    const [prefix, val1 = '', val2] = opt.split(':')
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
        if (
          val1 === 'normal' ||
          val1 === 'compact' ||
          val1 === 'super-compact'
        ) {
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
        // Legacy boolean: true → 0px spacing, false → 2px spacing (the value
        // the pre-unification override branch baked in for noSpacing=false).
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
    }
  }
  // snpcov is a "show only coverage" pseudo-mode. The unified
  // LinearAlignmentsDisplay has no explicit coverage-only flag — pileup
  // viewport height = display.height - coverageHeight, so we make coverage
  // fill the whole track. Done after the main loop so the user's height: or
  // coverageHeight: settings flow through first.
  if (opts.includes('snpcov') && display.setCoverageHeight && display.height) {
    display.setShowCoverage?.(true)
    display.setCoverageHeight(display.height)
  }
}

// react-app2 hosts every view type and accepts multiple assemblies, where the
// LGV-only react2 host could not. RPC runs on the main thread (the rpc
// defaultDriver default), so no worker is needed for headless export.
function createModel(data: Config) {
  return createViewState({
    config: {
      assemblies: data.assemblies,
      tracks: data.tracks,
      defaultSession: data.defaultSession as { name: string } | undefined,
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
}

type Model = ReturnType<typeof createModel>

async function renderLinear(model: Model, data: Config, opts: Opts) {
  const {
    loc,
    width = 1500,
    trackList = [],
    session: sessionParam,
    defaultSession,
    themeName,
    showGridlines,
    trackLabels,
    refseq,
  } = opts

  const { session } = model
  const view = (session.views[0] ??
    session.addView('LinearGenomeView', {})) as LinearGenomeViewModel

  view.setWidth(width)

  if (loc) {
    const { name } = data.assembly
    if (loc === 'all') {
      view.showAllRegionsInAssembly(name)
    } else {
      await view.navToLocString(loc, name)
    }
  } else if (!sessionParam && !defaultSession) {
    throw new Error(
      'No --loc specified (e.g. --loc chr1:1-10000 or --loc all). ' +
        'Alternatively pass --session or --defaultSession.',
    )
  }

  if (refseq) {
    const seqTrackId = data.assembly.sequence.trackId
    if (typeof seqTrackId === 'string') {
      view.showTrack(seqTrackId)
    }
  }

  for (const track of trackList) {
    applyTrackOpts(track, view)
  }

  return renderLinearToSvg(view, {
    rasterizeLayers: !opts.noRasterize,
    createCanvas: (w: number, h: number) =>
      createCanvas(w, h) as unknown as HTMLCanvasElement,
    themeName,
    showGridlines,
    trackLabels,
  })
}

// A comparative view sets `initialized` true as soon as it has regions to
// show, but its frozen `init` snapshot is consumed a moment later by an async
// autorun (which awaits both assemblies, navigates each sub-view, and attaches
// the comparison track). The SVG only has content once that autorun has run to
// completion and cleared `init`.
function whenViewReady(view: { initialized: boolean; init?: unknown }) {
  return when(() => view.initialized && !view.init)
}

// Dotplot and synteny both compare two assemblies. The views self-initialize
// from their frozen `init` prop, then renderToSvg rasterizes via the global
// node canvas (setupEnv). A missing --loc shows that assembly's whole genome.
async function renderComparative(model: Model, data: Config, opts: Opts) {
  const { mode, width = 1500, loc, loc2, themeName, trackLabels, showGridlines } =
    opts
  const [asm1, asm2] = data.assemblies
  if (!asm1 || !asm2) {
    throw new Error(
      'comparative mode requires two assemblies (--fasta + --fasta2, or --assembly + --assembly2)',
    )
  }

  const syntenyTrackIds = data.tracks
    .filter(track => track.type === 'SyntenyTrack')
    .map(track => track.trackId)
  const views = [
    loc ? { assembly: asm1.name, loc } : { assembly: asm1.name },
    loc2 ? { assembly: asm2.name, loc: loc2 } : { assembly: asm2.name },
  ]

  const { session } = model
  if (mode === 'dotplot') {
    const view = session.addView('DotplotView', {
      init: { views, tracks: syntenyTrackIds },
    }) as DotplotViewModel
    view.setWidth(width)
    await whenViewReady(view)
    return renderDotplotToSvg(view, {
      rasterizeLayers: !opts.noRasterize,
      themeName,
    })
  } else {
    // synteny track ids are per-level: tracks[i] sits between views[i] and
    // views[i+1], so a single comparison goes in level 0.
    const view = session.addView('LinearSyntenyView', {
      init: { views, tracks: syntenyTrackIds.map(id => [id]) },
    }) as LinearSyntenyViewModel
    view.setWidth(width)
    await whenViewReady(view)
    return renderSyntenyToSvg(view, {
      rasterizeLayers: !opts.noRasterize,
      themeName,
      trackLabels,
      showGridlines,
    })
  }
}

// Circular renders one assembly's chord tracks (e.g. a VCF of structural
// variants). The view picks each track's chord display automatically.
async function renderCircular(model: Model, data: Config, opts: Opts) {
  const { width = 1500, themeName } = opts
  const { session } = model
  const trackIds = data.tracks.map(track => track.trackId)
  const view = session.addView('CircularView', {
    init: { assembly: data.assembly.name, tracks: trackIds },
  }) as CircularViewModel
  view.setWidth(width)
  await whenViewReady(view)
  return renderCircularToSvg(view, {
    rasterizeLayers: !opts.noRasterize,
    themeName,
  })
}

export async function renderRegion(opts: Opts) {
  const data = readData(opts)
  const model = createModel(data)
  const result =
    opts.mode === 'dotplot' || opts.mode === 'synteny'
      ? await renderComparative(model, data, opts)
      : opts.mode === 'circular'
        ? await renderCircular(model, data, opts)
        : await renderLinear(model, data, opts)
  destroy(model)
  return result
}
