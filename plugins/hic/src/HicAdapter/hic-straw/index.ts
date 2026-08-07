// `HicFile` is the entry point directly. Upstream hic-straw put a `Straw` class
// in front of it as the public API, but in this port that wrapper forwarded
// three methods unchanged to the one consumer we have, so it was a name and a
// layer and nothing else.
export { default } from './hicFile.ts'
export { NO_DATA_FOR_RESOLUTION } from './hicFile.ts'
export type { Filehandle, HicMetadata, HicRegion } from './types.ts'
