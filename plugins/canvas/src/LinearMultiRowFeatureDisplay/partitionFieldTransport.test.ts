import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment, ctgA, ctgB } from './testEnv.ts'

// The `partitionField` slot is a deferred expression the worker evaluates once
// per feature, so the getter feeding `rpcProps()` must hand over the raw slot
// string: reading it through a resolving reader evaluates the callback here,
// with no feature in scope, and ships the empty string as an attribute name.
const RMSK = "jexl:split(split(feature.name,'#')[1],'/')[0]"

describe('partitionField reaches the worker unevaluated', () => {
  it('forwards a jexl slot as its raw expression string', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: RMSK },
    })
    const { display } = createDisplay()

    expect(display.partitionField).toBe(RMSK)
    expect(display.rpcProps().partitionField).toBe(RMSK)
  })

  it('leaves a plain attribute name alone', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: 'sample' },
    })
    const { display } = createDisplay()

    expect(display.rpcProps().partitionField).toBe('sample')
  })

  // The unset slot is the auto sentinel, resolved in the worker off the columns
  // the file turns out to carry. Sending the main thread's fallback guess
  // instead makes the repClass pick unreachable: the worker cannot tell a guess
  // from a choice.
  it('forwards the unset slot as the empty auto sentinel', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    expect(display.rpcProps().partitionField).toBe('')
  })
})

function regionData(resolvedPartitionField: string) {
  return {
    featureStarts: new Uint32Array([0]),
    featureEnds: new Uint32Array([100]),
    featureColors: new Uint32Array([0xff0000ff]),
    featureDeltas: new Int32Array(0),
    partitionValues: ['LINE'],
    featurePartitionIndex: new Uint32Array([0]),
    featureNames: ['L1HS'],
    featureIds: ['f1'],
    usedItemRgb: false,
    partitionCandidates: ['repClass', 'repFamily'],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField,
  }
}

function emptyRegionData() {
  return {
    ...regionData('name'),
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    partitionValues: [],
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    partitionCandidates: [],
    partitionCandidateValues: [],
  }
}

// Auto is resolved per region off a sample of the features that region holds,
// so two regions of one file can land on different attributes; once a region has
// answered, later fetches are told the answer.
describe('auto resolution is pinned once a region has answered', () => {
  it('is the auto sentinel until one has', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    expect(display.pinnedPartitionField).toBe('')
  })

  it('takes the loaded region answer, not the display default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'), ctgA)

    expect(display.pinnedPartitionField).toBe('repClass')
    // Still the auto sentinel where it is the invalidation key.
    expect(display.rpcProps().partitionField).toBe('')
  })

  it('leaves a configured slot alone', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: 'sample' },
    })
    const { display } = createDisplay()
    display.setRpcData(0, regionData('sample'), ctgA)

    expect(display.rpcProps().partitionField).toBe('sample')
  })

  // An empty region resolves nothing and falls through to the `name` fallback.
  // Pinned off that, every later region partitions by feature name — tens of
  // thousands of one-feature hairline rows, and nothing refetches them, since
  // the pin is deliberately not an rpcProps key.
  it('is not established by a region that came back empty', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, emptyRegionData(), ctgA)

    expect(display.pinnedPartitionField).toBe('')
    // ...and the empty region is not itself treated as unresolved data: it has
    // no feature to land in the wrong row.
    expect(display.regionHasData(0)).toBe(true)

    display.setRpcData(1, regionData('repClass'), ctgB)

    expect(display.pinnedPartitionField).toBe('repClass')
    expect(display.effectivePartitionField).toBe('repClass')
  })
})

// The regions of the first batch fan out in parallel, all told auto, so the pin
// cannot keep them together. `regionHasData` does: a region that answered
// something else reads as holding nothing and is re-issued with the field
// spelled out.
describe('regions that resolved differently reconcile to the pin', () => {
  it('reads a region that answered another field as holding no data', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'), ctgA)
    display.setRpcData(3, regionData('name'), ctgB)

    expect(display.pinnedPartitionField).toBe('repClass')
    expect(display.regionHasData(0)).toBe(true)
    expect(display.regionHasData(3)).toBe(false)
  })

  // It terminates because the worker echoes an explicit field back verbatim, so
  // the refetch answers the pin.
  it('settles once the refetch lands', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'), ctgA)
    display.setRpcData(3, regionData('name'), ctgB)

    display.setRpcData(3, regionData('repClass'), ctgB)

    expect(display.regionHasData(3)).toBe(true)
  })

  it('leaves the empty regions of a whole-genome load alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'), ctgA)
    display.setRpcData(1, emptyRegionData(), ctgB)

    expect(display.regionHasData(1)).toBe(true)
  })

  it('has nothing to reconcile against a configured slot', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: 'sample' },
    })
    const { display } = createDisplay()
    display.setRpcData(0, regionData('sample'), ctgA)
    display.setRpcData(1, regionData('sample'), ctgB)

    expect(display.regionHasData(0)).toBe(true)
    expect(display.regionHasData(1)).toBe(true)
  })
})

// The band swaps out what is drawn, and the pin is not that: reading it off the
// empty `drawnRegionData` makes every held region disagree with the auto
// sentinel and re-issues the lot on every pass over a track that is deliberately
// fetching nothing.
describe('the pin survives the density band standing in', () => {
  function bandedDisplay() {
    const { createDisplay } = createTestEnvironment({
      densityAdapter: { type: 'BigWigAdapter', uri: 'segments.bw' },
    })
    const { display, view } = createDisplay()
    view.zoomTo(100)
    display.setRpcData(0, regionData('repClass'), ctgA)
    setConf(display, 'densityTier', 'density')
    expect(display.coarseTierStandsIn).toBe(true)
    return display
  }

  it('keeps the field a loaded region answered', () => {
    const display = bandedDisplay()

    expect(display.pinnedPartitionField).toBe('repClass')
    expect(display.effectivePartitionField).toBe('repClass')
  })

  it('does not re-issue every held region', () => {
    const display = bandedDisplay()

    expect(display.regionHasData(0)).toBe(true)
  })

  it('keeps the "Partition by..." candidates the data carries', () => {
    const display = bandedDisplay()

    expect(display.partitionCandidates).toEqual(['repClass', 'repFamily'])
  })

  // ...and the rows themselves still go, which is the swap doing its job.
  it('still empties the drawn rows', () => {
    const display = bandedDisplay()

    expect(display.sources).toHaveLength(0)
  })
})
