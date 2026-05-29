import path from 'path'

import { destroy } from '@jbrowse/mobx-state-tree'
import { renderToSvg } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { createCanvas } from 'canvas'

import { readData } from './readData.ts'
import { booleanize } from './util.ts'

import type { Entry } from './parseArgv.ts'
import type { Opts } from './readData.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type { Opts } from './readData.ts'
export { makeTrackConfig, readData } from './readData.ts'

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
          display.setPairedConnections?.('samplot')
        } else if (val1 === 'up' || val1 === 'down') {
          display.setPairedConnections?.('arc')
          display.setPairedConnectionsDown?.(val1 === 'down')
        } else {
          display.setPairedConnections?.('off')
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
      case 'pairedConnectionsHeight': {
        if (val1) {
          display.setPairedConnectionsHeight?.(+val1)
        }
        break
      }
      case 'pairedConnectionsLineWidth': {
        if (val1) {
          display.setPairedConnectionsLineWidth?.(+val1)
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

export async function renderRegion(opts: Opts) {
  const data = readData(opts)
  const model = createViewState({ ...data })
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
  const { view } = session
  const { assemblyManager } = model

  view.setWidth(width)

  if (loc) {
    const { name } = assemblyManager.assemblies[0]!
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

  const result = await renderToSvg(view, {
    rasterizeLayers: !opts.noRasterize,
    createCanvas: (w: number, h: number) =>
      createCanvas(w, h) as unknown as HTMLCanvasElement,
    themeName,
    showGridlines,
    trackLabels,
  })
  destroy(model)
  return result
}
