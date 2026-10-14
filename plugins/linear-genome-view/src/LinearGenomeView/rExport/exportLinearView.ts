import {
  fullConfSnapshot,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { exportTracksToR, locationPath } from './rScript.ts'

import type { LinearGenomeViewModel } from '../model.ts'
import type { RExportTrack, Region } from './rScript.ts'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

type Track = LinearGenomeViewModel['tracks'][number]

function trackConf(track: Track) {
  return track.configuration as BaseTrackConfig
}

/** The regions on screen, each displayed region cut to what the view shows of it. */
function viewRegions(view: LinearGenomeViewModel): Region[] {
  const blocks = view.dynamicBlocks.contentBlocks
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
      readConfObject(trackConf(track), 'adapter'),
      view.assemblyNames[0],
      { sessionId: getRpcSessionId(track) },
    )
    const differing = Object.entries(map).filter(([k, v]) => k !== v)
    return differing.length ? Object.fromEntries(differing) : undefined
  } catch {
    return undefined
  }
}

async function tracksOf(view: LinearGenomeViewModel) {
  const reference = referenceOf(view)
  const tracks: RExportTrack[] = []
  for (const track of view.tracks) {
    const display = track.displays[0]
    if (display) {
      const { type, displayId, ...written } = getSnapshot(
        display.configuration,
      ) as Record<string, unknown>
      const { heightMode, height } = fullConfSnapshot(display.configuration)
      tracks.push({
        trackId: track.configuration.trackId,
        trackName:
          readConfObject(trackConf(track), 'name') ||
          track.configuration.trackId,
        displayType: display.type,
        adapter: readConfObject(trackConf(track), 'adapter') as Record<
          string,
          unknown
        >,
        display: written,
        heightMode,
        height,
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
    bpPerPx: view.bpPerPx,
    out,
    notes: view.displayedRegions.some(r => r.reversed)
      ? ['view: shown right to left, where the figure runs left to right']
      : [],
  })
}

/** Downloads the view's R script, telling the user what it leaves out. */
export async function downloadRScript(view: LinearGenomeViewModel) {
  const session = getSession(view)
  try {
    const { saveAs } = await import('@jbrowse/core/util/FileSaver')
    const { script, notes } = await exportLinearViewToR(view)
    if (!script) {
      session.notify(
        `No open track has an R export. ${notes.join('; ')}`,
        'warning',
      )
      return
    }
    saveAs(
      new Blob([script], { type: 'text/plain;charset=utf-8' }),
      'jbrowse_view.R',
    )
    if (notes.length) {
      session.notify(
        `Exported with ${notes.length} note${notes.length === 1 ? '' : 's'} in the script header`,
        'info',
      )
    }
  } catch (e) {
    session.notifyError(`${e}`, e)
  }
}
