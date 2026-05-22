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

    if (prefix === 'height') {
      if (val1) {
        display.setHeight(+val1)
      }
    } else if (prefix === 'sort') {
      display.setSortedBy?.(val1, val2)
    } else if (prefix === 'color') {
      if (display.setColorScheme) {
        display.setColorScheme({ type: val1, tag: val2 })
      } else {
        display.setColor?.(val1)
      }
    } else if (prefix === 'arcs') {
      // 'off' | 'up' | 'down' | 'samplot' — paired-end arcs / samplot view
      display.setPairedArcs?.(val1)
    } else if (prefix === 'linkedReads') {
      // 'off' | 'normal' | 'bezier' — 10x/linked-read chain overlay
      display.setLinkedReads?.(val1)
    } else if (prefix === 'sashimi') {
      // 'off' | 'up' | 'down' — splice-junction arcs
      display.setSashimiArcs?.(val1)
    } else if (prefix === 'coverage') {
      display.setShowCoverage?.(booleanize(val1 || 'true'))
    } else if (prefix === 'featureHeight') {
      if (val1 === 'normal') {
        display.setFeatureHeight?.(7)
        display.setNoSpacing?.(false)
      } else if (val1 === 'compact') {
        display.setFeatureHeight?.(2)
        display.setNoSpacing?.(true)
      } else if (val1 === 'super-compact') {
        display.setFeatureHeight?.(1)
        display.setNoSpacing?.(true)
      } else if (val1) {
        const n = +val1
        if (isNaN(n)) {
          throw new Error(
            `Invalid featureHeight "${val1}". Use normal, compact, super-compact, or a number.`,
          )
        }
        display.setFeatureHeight?.(n)
      }
    } else if (prefix === 'noSpacing') {
      display.setNoSpacing?.(booleanize(val1 || 'true'))
    } else if (prefix === 'softClipping') {
      if (booleanize(val1 || 'true') !== display.showSoftClipping) {
        display.toggleSoftClipping?.()
      }
    } else if (prefix === 'force') {
      if (booleanize(val1 || 'true')) {
        display.setFeatureDensityStatsLimit({ bytes: Number.MAX_VALUE })
      }
    } else if (prefix === 'autoscale') {
      display.setAutoscale(val1)
    } else if (prefix === 'minmax') {
      if (val1) {
        display.setMinScore(+val1)
      }
      if (val2) {
        display.setMaxScore(+val2)
      }
    } else if (prefix === 'scaletype') {
      display.setScaleType(val1)
    } else if (prefix === 'crosshatch') {
      display.setCrossHatches(booleanize(val1 || 'false'))
    } else if (prefix === 'fill') {
      display.setFill(booleanize(val1 || 'true'))
    } else if (prefix === 'resolution') {
      const val =
        val1 === 'fine' ? 10 : val1 === 'superfine' ? 100 : Number(val1)
      display.setResolution(Number.isNaN(val) ? 1 : val)
    }
  }
}

export async function renderRegion(opts: Opts) {
  const model = createViewState({
    ...readData(opts),
  })
  const {
    loc,
    width = 1500,
    trackList = [],
    session: sessionParam,
    defaultSession,
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

  for (const track of trackList) {
    applyTrackOpts(track, view)
  }

  const result = await renderToSvg(view, {
    rasterizeLayers: !opts.noRasterize,
    createCanvas: (w: number, h: number) =>
      createCanvas(w, h) as unknown as HTMLCanvasElement,
    ...opts,
  })
  destroy(model)
  return result
}
