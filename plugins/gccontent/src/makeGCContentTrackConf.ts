import { makeTrackId } from '@jbrowse/core/util'

/**
 * A standalone GCContentTrack config that wraps a sequence adapter in a
 * GCContentAdapter, for the "Add GC content track" menu row. Window params are
 * optional; omitted, the display's defaults apply.
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
        type: 'LinearGCContentDisplay',
        windowSize,
        windowDelta,
        gcMode,
      },
    ],
  }
}
