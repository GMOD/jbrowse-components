import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { exportTracksToR } from './rScript.ts'

import type { LinearGenomeViewModel } from '../model.ts'
import type { RExportTrack, Region } from './rScript.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

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

/** The view's assembly config as written. */
function assemblyOf(view: LinearGenomeViewModel) {
  const name = view.assemblyNames[0]
  const configuration: AnyConfigurationModel | undefined = name
    ? getSession(view).assemblyManager.get(name)?.configuration
    : undefined
  return configuration
    ? (getSnapshot(configuration) as Record<string, unknown>)
    : undefined
}

function tracksOf(view: LinearGenomeViewModel) {
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
          readConfObject(track.configuration, 'name') ||
          track.configuration.trackId,
        displayType: display.type,
        adapter: readConfObject(track.configuration, 'adapter') as Record<
          string,
          unknown
        >,
        display: written,
        heightMode,
        height,
      })
    }
  }
  return tracks
}

/** The R script that redraws the tracks open in the view, over its visible regions. */
export function exportLinearViewToR(view: LinearGenomeViewModel, out?: string) {
  return exportTracksToR({
    tracks: tracksOf(view),
    regions: viewRegions(view),
    assembly: assemblyOf(view),
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
    const { script, notes } = exportLinearViewToR(view)
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
