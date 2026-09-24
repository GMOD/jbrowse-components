import { makeTrackId } from '@jbrowse/core/util'

/**
 * Build a standalone GCContentTrack config that wraps a sequence adapter in a
 * GCContentAdapter. Shared by the "Add GC content track" menu row and the GC
 * content display's `addGCContentTrack`. Window params are optional — omit them
 * to let the display config defaults apply.
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
