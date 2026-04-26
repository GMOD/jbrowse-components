import path from 'path'

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

function applyTrackOpts(
  trackEntry: Entry,
  view: LinearGenomeViewModel,
  extra: (arg: string) => string = c => c,
) {
  const [, [track, ...opts]] = trackEntry
  if (!track) {
    throw new Error('invalid command line args')
  }
  const currentTrack = view.showTrack(extra(track))
  const display = currentTrack.displays[0]
  for (const opt of opts) {
    // apply height to any track
    if (opt.startsWith('height:')) {
      const [, height] = opt.split(':')
      if (height) {
        display.setHeight(+height)
      }
    }

    // apply sort to pileup
    else if (opt.startsWith('sort:')) {
      if (display.PileupDisplay) {
        const [, type, tag] = opt.split(':')
        display.PileupDisplay.setSortedBy(type, tag)
      }
    }

    // apply color scheme to pileup
    else if (opt.startsWith('color:')) {
      const [, type, tag] = opt.split(':')
      if (display.PileupDisplay) {
        display.PileupDisplay.setColorScheme({ type, tag })
      } else {
        display.setColor(type)
      }
    }

    // force track to render even if maxbpperpx limit hit...
    else if (opt.startsWith('force:')) {
      const [, force] = opt.split(':')
      if (force) {
        display.setFeatureDensityStatsLimit({ bytes: Number.MAX_VALUE })
      }
    }

    // apply wiggle autoscale
    else if (opt.startsWith('autoscale:')) {
      const [, autoscale] = opt.split(':')
      display.setAutoscale(autoscale)
    }

    // apply min and max score to wiggle
    else if (opt.startsWith('minmax:')) {
      const [, min, max] = opt.split(':')
      if (min) {
        display.setMinScore(+min)
      }
      if (max) {
        display.setMaxScore(+max)
      }
    }

    // apply linear or log scale to wiggle
    else if (opt.startsWith('scaletype:')) {
      const [, scaletype] = opt.split(':')
      display.setScaleType(scaletype)
    }

    // draw crosshatches on wiggle
    else if (opt.startsWith('crosshatch:')) {
      const [, val = 'false'] = opt.split(':')
      display.setCrossHatches(booleanize(val))
    }

    // turn off fill on bigwig with fill:false
    else if (opt.startsWith('fill:')) {
      const [, val = 'true'] = opt.split(':')
      display.setFill(booleanize(val))
    }

    // set resolution:superfine to use finer bigwig bin size
    else if (opt.startsWith('resolution:')) {
      const [, rawVal] = opt.split(':')
      const val =
        rawVal === 'fine' ? 10 : rawVal === 'superfine' ? 100 : Number(rawVal)
      display.setResolution(val || 1)
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
    console.warn('No loc specified')
  }

  for (const track of trackList) {
    applyTrackOpts(track, view, extra => path.basename(extra))
  }

  return renderToSvg(view, {
    rasterizeLayers: !opts.noRasterize,
    createCanvas: (w: number, h: number) =>
      createCanvas(w, h) as unknown as HTMLCanvasElement,
    ...opts,
  })
}
