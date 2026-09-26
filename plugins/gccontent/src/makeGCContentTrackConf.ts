import { makeTrackId } from '@jbrowse/core/util'

/**
 * A GCContentTrack config that wraps a sequence adapter in a GCContentAdapter,
 * for the "Add GC content track" menu row. The window and step are optional;
 * omitted, the adapter's defaults apply.
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
      gcMode,
      ...(windowSize === undefined ? {} : { windowSize }),
      ...(windowDelta === undefined ? {} : { windowDelta }),
    },
  }
}
