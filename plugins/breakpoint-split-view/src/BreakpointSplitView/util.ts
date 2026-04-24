import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { LayoutRecord } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Display {
  searchFeatureByID?: (str: string) => LayoutRecord
}

interface Track {
  displays: Display[]
  configuration: AnyConfigurationModel
}

// Must match the CSS height of viewDivider in BreakpointSplitView.tsx
export const VIEW_DIVIDER_HEIGHT = 3
// Must match RESIZE_HANDLE_HEIGHT in @jbrowse/plugin-linear-genome-view
export const TRACK_RESIZE_HANDLE_HEIGHT = 3
// Must match the minimized track height in TrackRenderingContainer.tsx
export const MINIMIZED_TRACK_HEIGHT = 20

// https://stackoverflow.com/a/49186706/2129219 the array-intersection package
// on npm has a large kb size, and we are just intersecting open track ids so
// simple is better
export function intersect<T>(
  cb: (l: T) => string,
  a1: T[] = [],
  a2: T[] = [],
  ...rest: T[][]
): T[] {
  const ids = new Set(a2.map(elt => cb(elt)))
  const a12 = a1.filter(value => ids.has(cb(value)))
  return rest.length === 0 ? a12 : intersect(cb, a12, ...rest)
}

export function calc(track: Track, f: Feature) {
  return track.displays[0]!.searchFeatureByID?.(f.id())
}

export async function getBlockFeatures(
  model: { views: LinearGenomeViewModel[] },
  track: Track,
) {
  const { views } = model
  const { rpcManager } = getSession(model)
  const sessionId = getRpcSessionId(track)

  return Promise.all(
    views.flatMap(async view =>
      rpcManager.call(sessionId, 'BreakpointGetFeatures', {
        adapterConfig: getConf(track, ['adapter']),
        sessionId,
        regions: view.staticBlocks.contentBlocks,
      }),
    ),
  )
}
