// This package is the desktop-facing wrapper around `@jbrowse/text-indexing-core`
// — it adds `indexTracks` and the config helpers below, and nothing else. It
// deliberately re-exports none of core's surface: a symbol gets one import path,
// so the two packages cannot drift into disagreeing about the same name.
export { createTextSearchConf, findTrackConfigsToIndex } from './util.ts'
export type { indexType } from './util.ts'

export { indexTracks } from './TextIndexing.ts'
