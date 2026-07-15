import { makeTrackId } from '@jbrowse/core/util'

/**
 * Build a standalone GCContentTrack config that wraps a sequence adapter in a
 * GCContentAdapter. Shared by the "Add GC content track" actions on the
 * reference sequence display and the hierarchical track selector. Window
 * params are optional — omit them to let the display config defaults apply.
 */
export function makeGCContentTrackConf({
  assemblyNames,
  sequenceAdapter,
  gcMode,
  windowSize,
  windowDelta,
}: {
  assemblyNames: string[]
  sequenceAdapter: unknown
  gcMode: 'content' | 'skew'
  windowSize?: number
  windowDelta?: number
}) {
  const name = gcMode === 'skew' ? 'GC skew' : 'GC content'
  return {
    trackId: makeTrackId({ name }),
    type: 'GCContentTrack',
    name,
    assemblyNames,
    adapter: {
      type: 'GCContentAdapter',
      sequenceAdapter,
    },
    displays: [
      {
        type: 'LinearGCContentTrackDisplay',
        windowSize,
        windowDelta,
        gcMode,
      },
    ],
  }
}
