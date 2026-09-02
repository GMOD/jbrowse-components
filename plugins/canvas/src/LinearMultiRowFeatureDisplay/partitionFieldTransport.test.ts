import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

// The `partitionField` slot is a DEFERRED expression: the worker binds `feature`
// and evaluates it once per feature (makeFeaturePartitionResolver). So the model
// getter that feeds `rpcProps()` must hand the worker the raw slot string, the
// same way `colorConfig` does — reading it through a resolving reader evaluates
// the callback here, on the main thread, with no feature in scope.
//
// That is what these tests pin. Read through `readConfObject` the rmsk
// expression resolved to '' (jexl's `feature` is undefined, `feature.name`
// undefined, the total `split` coerces it to ''), and '' shipped to the worker
// as an attribute name — so every feature answered `feature.get('')` =>
// undefined => one unnamed row. Before `split` was made total the same read
// threw a TypeError out of a config getter instead, which banners the display.
// Both symptoms, one cause.
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

  // The unset slot is the AUTO sentinel, and auto is resolved in the worker off
  // the columns the file turns out to carry (resolvePartitionField). Sending the
  // main thread's guess instead — 'name', which is what auto falls back to —
  // would make the repClass pick unreachable: the worker cannot tell a guess
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
    legendCandidates: [],
    resolvedPartitionField,
  }
}

// What the worker returns for a region with nothing in it: no features, so no
// rows and no candidates to collect, and `resolvePartitionField` falls through
// to its degenerate `name`.
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
  }
}

// Auto is resolved per region, off a SAMPLE of the features that region holds,
// so two regions of one file can land on different attributes — after which the
// same row name means two things and the rows of one display stop lining up.
// Once a region has answered, later fetches are told the answer.
describe('auto resolution is pinned once a region has answered', () => {
  it('is the auto sentinel until one has', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    expect(display.pinnedPartitionField).toBe('')
  })

  it('takes the loaded region answer, not the display default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'))

    expect(display.pinnedPartitionField).toBe('repClass')
    // still the auto sentinel where it is the invalidation key
    expect(display.rpcProps().partitionField).toBe('')
  })

  it('leaves a configured slot alone', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: 'sample' },
    })
    const { display } = createDisplay()
    display.setRpcData(0, regionData('sample'))

    expect(display.rpcProps().partitionField).toBe('sample')
  })

  // A region with nothing in it resolved nothing: no features, so no candidates,
  // so `resolvePartitionField` answered the `name` fallback. Pinned off THAT,
  // every later region was told to partition by feature name — on the rmsk files
  // auto exists for, tens of thousands of one-feature hairline rows, with the
  // menu's radio checking a field nobody chose and clustering keyed on it.
  // Nothing ever refetched it either: the pin is deliberately not an rpcProps
  // key.
  it('is not established by a region that came back empty', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, emptyRegionData())

    expect(display.pinnedPartitionField).toBe('')
    // and the empty region is not itself treated as unresolved data — it has no
    // feature to land in the wrong row, so refetching it would buy nothing
    expect(display.regionHasData(0)).toBe(true)

    display.setRpcData(1, regionData('repClass'))

    expect(display.pinnedPartitionField).toBe('repClass')
    expect(display.effectivePartitionField).toBe('repClass')
  })
})

// The regions of the FIRST batch fan out in parallel, all of them told auto, so
// the pin cannot keep them together — each worker resolves off its own feature
// sample. `regionHasData` is what does: a region that answered something else
// reads as holding nothing, and the fetch plan re-issues it with the field
// spelled out.
describe('regions that resolved differently reconcile to the pin', () => {
  it('reads a region that answered another field as holding no data', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'))
    display.setRpcData(3, regionData('name'))

    expect(display.pinnedPartitionField).toBe('repClass')
    expect(display.regionHasData(0)).toBe(true)
    expect(display.regionHasData(3)).toBe(false)
  })

  // Terminating, and this is why: the worker echoes an explicit field back
  // verbatim, so the refetch the line above asks for answers the pin.
  it('settles once the refetch lands', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'))
    display.setRpcData(3, regionData('name'))

    display.setRpcData(3, regionData('repClass'))

    expect(display.regionHasData(3)).toBe(true)
  })

  it('leaves the empty regions of a whole-genome load alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setRpcData(0, regionData('repClass'))
    display.setRpcData(1, emptyRegionData())

    expect(display.regionHasData(1)).toBe(true)
  })

  it('has nothing to reconcile against a configured slot', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { partitionField: 'sample' },
    })
    const { display } = createDisplay()
    display.setRpcData(0, regionData('sample'))
    display.setRpcData(1, regionData('sample'))

    expect(display.regionHasData(0)).toBe(true)
    expect(display.regionHasData(1)).toBe(true)
  })
})

// The band swaps out what is DRAWN, and the pin is not that. `drawnRegionData`
// is empty while the density tier stands in, so reading the pin off it made
// every held region disagree with an auto sentinel, `regionHasData` answered
// no for all of them, and the fetch plan re-issued the lot on every pass over
// a track that is deliberately fetching nothing. The "Partition by..." submenu
// went with it, since its candidates are discovered from the same data.
describe('the pin survives the density band standing in', () => {
  function bandedDisplay() {
    const { createDisplay } = createTestEnvironment({
      densityAdapter: { type: 'BigWigAdapter', uri: 'segments.bw' },
    })
    const { display, view } = createDisplay()
    view.zoomTo(100)
    display.setRpcData(0, regionData('repClass'))
    setConf(display, 'densityTier', 'density')
    expect(display.densityBandActive).toBe(true)
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

  // and the rows themselves still go, which is the swap doing its job
  it('still empties the drawn rows', () => {
    const display = bandedDisplay()

    expect(display.sources).toHaveLength(0)
  })
})
