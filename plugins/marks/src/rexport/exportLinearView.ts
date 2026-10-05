import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { markPlotSettingsOf } from '../LinearMarkDisplay/markPlot.ts'
import { exportTracksToR } from './exportView.ts'
import { locationPath } from './frameFor.ts'

import type { RExportTrack } from './exportView.ts'
import type { Region } from './rScript.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type Track = LinearGenomeViewModel['tracks'][number]

function viewRegions(view: LinearGenomeViewModel): Region[] {
  const blocks = view.coarseDynamicBlocks
  if (blocks.length === 0) {
    return view.displayedRegions.map(r => ({
      refName: r.refName,
      start: Math.floor(r.start),
      end: Math.ceil(r.end),
    }))
  }
  const byRegion = new Map<number, Region>()
  for (const block of blocks) {
    const key = block.displayedRegionIndex ?? -1
    const held = byRegion.get(key)
    if (held?.refName === block.refName) {
      held.start = Math.min(held.start, Math.floor(block.start))
      held.end = Math.max(held.end, Math.ceil(block.end))
    } else {
      byRegion.set(key, {
        refName: block.refName,
        start: Math.floor(block.start),
        end: Math.ceil(block.end),
      })
    }
  }
  return [...byRegion.values()]
}

function referenceOf(view: LinearGenomeViewModel) {
  const name = view.assemblyNames[0]
  const assembly = name ? getSession(view).assemblyManager.get(name) : undefined
  const sequence = assembly
    ? (getConf(assembly, ['sequence', 'adapter']) as Record<string, unknown>)
    : undefined
  return (
    locationPath(sequence?.fastaLocation) ??
    locationPath(sequence?.twoBitLocation) ??
    locationPath(sequence?.uri)
  )
}

async function refNamesOf(view: LinearGenomeViewModel, track: Track) {
  try {
    const map = await getSession(view).assemblyManager.getRefNameMapForAdapter(
      getConf(track, 'adapter'),
      view.assemblyNames[0],
      { sessionId: getRpcSessionId(track) },
    )
    const differing = Object.entries(map).filter(([k, v]) => k !== v)
    return differing.length ? Object.fromEntries(differing) : undefined
  } catch {
    return undefined
  }
}

function displaySettings(display: {
  type: string
  configuration: AnyConfigurationModel
}) {
  const snapshot = getSnapshot<Record<string, unknown>>(display.configuration)
  return display.type === 'LinearMarkDisplay'
    ? { ...snapshot, ...markPlotSettingsOf(display.configuration) }
    : snapshot
}

async function tracksOf(view: LinearGenomeViewModel) {
  const reference = referenceOf(view)
  const tracks: RExportTrack[] = []
  for (const track of view.tracks) {
    const display = track.displays[0]
    if (display) {
      tracks.push({
        trackId: track.configuration.trackId,
        trackName: `${getConf(track, 'name') || track.configuration.trackId}`,
        displayType: display.type,
        adapter: getConf(track, 'adapter') as Record<string, unknown>,
        display: displaySettings(display),
        reference,
        refNames: await refNamesOf(view, track),
      })
    }
  }
  return tracks
}

/** The R script that redraws the tracks open in the view, over its visible regions. */
export async function exportLinearViewToR(
  view: LinearGenomeViewModel,
  out?: string,
) {
  return exportTracksToR({
    tracks: await tracksOf(view),
    regions: viewRegions(view),
    out,
  })
}
