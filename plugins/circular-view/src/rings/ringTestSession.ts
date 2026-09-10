import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { RingDisplay } from './ringHost.ts'

export const CTG_A_BP = 16000
export const CTG_B_BP = 8000

/**
 * A two-contig assembly and one track, opened on a circular view as a ring.
 * The display is whichever the track's config names first, or the one the
 * caller asks for.
 */
export async function ringTestSession(
  track: Record<string, unknown>,
  displayType?: string,
) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: CTG_A_BP,
            seq: 'a'.repeat(CTG_A_BP),
          },
          {
            refName: 'ctgB',
            uniqueId: 'ctgB',
            start: 0,
            end: CTG_B_BP,
            seq: 'a'.repeat(CTG_B_BP),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'ring',
    name: 'ring',
    assemblyNames: ['volvox'],
    ...track,
  })
  const view = (await session.launchView('CircularView', {
    assembly: 'volvox',
    tracks: [
      displayType
        ? { trackId: 'ring', displaySnapshot: { type: displayType } }
        : 'ring',
    ],
  })) as CircularViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0] as RingDisplay & {
    host: unknown
    canvasWidthPx: number
    loadedRegions: ReadonlyMap<number, unknown>
    renderBlocks: { screenStartPx: number; screenEndPx: number }[]
    displayPhase: string
    error: unknown
  }
  return { session, view, display }
}

/**
 * A strip element the way `RingStrips` mounts one: a wrapper holding a chrome
 * with a canvas of the strip's size, so `ringCells` finds a strip to sample.
 */
export function fakeStrip(width: number, height: number) {
  const strip = document.createElement('div')
  const chrome = document.createElement('div')
  chrome.dataset.displayId = 'ring'
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  chrome.append(canvas)
  strip.append(chrome)
  return { strip, chrome, canvas }
}
