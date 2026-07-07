export const syntenyTypes = [
  'PAFAdapter',
  'ChainAdapter',
  'DeltaAdapter',
  'BlastTabularAdapter',
  'MashMapAdapter',
  'MCScanAnchorsAdapter',
  'MCScanSimpleAnchorsAdapter',
  'MCScanBlocksAdapter',
  'PairwiseIndexedPAFAdapter',
  'AllVsAllPAFAdapter',
  'AllVsAllIndexedPAFAdapter',
]

export const pairwiseTypes = [
  'PAFAdapter',
  'ChainAdapter',
  'DeltaAdapter',
  'MashMapAdapter',
  'BlastTabularAdapter',
  'PairwiseIndexedPAFAdapter',
]

export const mcscanTypes = [
  'MCScanAnchorsAdapter',
  'MCScanSimpleAnchorsAdapter',
]

// multi-genome synteny files: one file backs the N-1 bands of a multi-way
// view, so their add-track forms collect an assembly list rather than a single
// query/target pair
export const mcscanBlocksTypes = ['MCScanBlocksAdapter']

export const allVsAllTypes = ['AllVsAllPAFAdapter', 'AllVsAllIndexedPAFAdapter']
