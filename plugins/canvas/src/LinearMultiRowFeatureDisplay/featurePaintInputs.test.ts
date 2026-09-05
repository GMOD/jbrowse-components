import { autorun } from 'mobx'

import { createTestEnvironment, ctgA, ctgB } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function regionData(): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array([0, 100]),
    featureEnds: new Uint32Array([100, 200]),
    featureColors: new Uint32Array([0xff0000ff, 0xff00ff00]),
    featureDeltas: new Int32Array(0),
    partitionValues: ['sampleA', 'sampleB'],
    featurePartitionIndex: new Uint32Array([0, 1]),
    featureNames: ['segA', 'segB'],
    featureIds: ['a', 'b'],
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

function makeDisplay() {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, regionData(), ctgA)
  return display
}

// `installUpload` memoizes the display's declared `inputs`, so what that getter
// reads decides how often every region's instance buffer is rebuilt. This stands
// in for the helper's computed, which needs a GPU backend.
function countRecomputes(read: () => unknown) {
  let n = 0
  const dispose = autorun(() => {
    read()
    n++
  })
  return { count: () => n, dispose }
}

describe('featurePaintInputs', () => {
  // A track-height drag moves `height`, and so `renderState`, every frame, but
  // the instance buffer holds no geometry — that reaches the shader as
  // uniforms.
  it('survives the geometry moving under it', () => {
    const display = makeDisplay()
    const paint = countRecomputes(() => display.featurePaintInputs)
    // the encoded channels have the same dependency set, and `featureAt`
    // runs per pointer frame off them
    const contexts = countRecomputes(() => display.encodedChannels)
    const render = countRecomputes(() => display.renderState)

    display.setRowHeight(14)
    display.setHeight(400)

    expect(render.count()).toBeGreaterThan(1)
    expect(paint.count()).toBe(1)
    expect(contexts.count()).toBe(1)

    paint.dispose()
    contexts.dispose()
    render.dispose()
  })

  // The three things that do change what paints still invalidate it, or a
  // reorder, recolor or toggle silently keeps the old buffer.
  it.each([
    [
      'a reorder',
      (d: ReturnType<typeof makeDisplay>) => {
        d.setLayout([{ name: 'sampleB' }, { name: 'sampleA' }])
      },
    ],
    [
      'a recolor',
      (d: ReturnType<typeof makeDisplay>) => {
        d.setLayout([{ name: 'sampleA', color: 'red' }, { name: 'sampleB' }])
      },
    ],
    [
      'a category toggle',
      (d: ReturnType<typeof makeDisplay>) => {
        d.setHiddenCategories(['segA'])
      },
    ],
  ])('still invalidates on %s', (_label, mutate) => {
    const display = makeDisplay()
    const paint = countRecomputes(() => display.featurePaintInputs)

    mutate(display)

    expect(paint.count()).toBe(2)
    paint.dispose()
  })

  // The hit test reads `encodedChannels` out of a React event handler, so
  // nothing there is tracked and MobX drops the value as it hands it over.
  // `afterAttach` holds an observer so the cache survives between pointer
  // frames.
  it('stays memoized for an untracked reader', () => {
    const display = makeDisplay()

    const first = display.encodedChannels
    expect(display.encodedChannels).toBe(first)

    display.setLayout([{ name: 'sampleB' }, { name: 'sampleA' }])
    expect(display.encodedChannels).not.toBe(first)
  })

  // A plain `sourcesWithoutLayout` getter hands out a fresh array on every write
  // to `rpcDataMap`, and `installUpload` clears its whole encode cache when this
  // identity moves — so region k's arrival re-encodes the byte-identical
  // instance buffer of regions 1..k-1.
  it('survives a second region discovering the rows it already had', () => {
    const display = makeDisplay()
    const paint = countRecomputes(() => display.featurePaintInputs)

    display.setRpcData(1, regionData(), ctgB)

    expect(paint.count()).toBe(1)
    paint.dispose()
  })

  it('still invalidates when a second region brings a new row', () => {
    const display = makeDisplay()
    const paint = countRecomputes(() => display.featurePaintInputs)

    display.setRpcData(
      1,
      {
        ...regionData(),
        partitionValues: ['sampleA', 'sampleC'],
      },
      ctgB,
    )

    expect(paint.count()).toBe(2)
    paint.dispose()
  })

  // Region k's arrival must not re-encode regions 1..k-1: a whole-genome load
  // would pay that once per region that lands, and `mapUploadSync` diffs on
  // exactly the reference identity asserted here.
  it('reuses the already-loaded regions encodings when another region lands', () => {
    const display = makeDisplay()
    const first = display.encodedChannels.get(0)

    display.setRpcData(1, regionData(), ctgB)

    expect(display.encodedChannels.get(0)).toBe(first)
    expect(display.encodedChannels.get(1)).toBeDefined()
  })

  it('re-encodes the region whose data was replaced', () => {
    const display = makeDisplay()
    const first = display.encodedChannels.get(0)

    display.setRpcData(0, regionData(), ctgA)

    expect(display.encodedChannels.get(0)).not.toBe(first)
  })

  it('drops a region that leaves the map', () => {
    const display = makeDisplay()
    const first = display.encodedChannels.get(0)

    display.dropLoadedRegion(0)
    expect(display.encodedChannels.size).toBe(0)

    display.setRpcData(0, regionData(), ctgA)
    expect(display.encodedChannels.get(0)).not.toBe(first)
  })

  // The upload takes the held map as identity cells, so its counts are the
  // memo's: a resize moves nothing, a reorder moves every region, a region
  // landing moves only itself.
  it('hands the upload the same references the memo holds', () => {
    const display = makeDisplay()
    const uploads: number[] = []
    const releases: number[] = []
    display.startRenderingBackend({
      upload(key: number) {
        uploads.push(key)
      },
      release(key: number) {
        releases.push(key)
      },
      setErrorHandler() {},
      renderBlocks: () => true,
      dispose() {},
    })
    expect(uploads).toEqual([0])

    display.setRowHeight(14)
    display.setHeight(400)
    expect(uploads).toEqual([0])

    display.setRpcData(1, regionData(), ctgB)
    expect(uploads).toEqual([0, 1])

    display.setLayout([{ name: 'sampleB' }, { name: 'sampleA' }])
    expect(uploads.slice(2).sort()).toEqual([0, 1])
    expect(uploads).toHaveLength(4)

    display.dropLoadedRegion(1)
    expect(releases).toEqual([1])
    expect(uploads).toHaveLength(4)
  })

  // `renderState` must keep carrying all three: the SVG export paints the
  // screen's own encoding under a `renderState`-derived state, and the two
  // agree only while the encode's inputs are the paint half of it.
  it('is the paint half of renderState, not a second copy of it', () => {
    const display = makeDisplay()
    // Inside a reaction, where MobX actually memoizes a computed: read bare it
    // re-evaluates per access and every identity below would differ for a reason
    // unrelated to the sharing under test.
    const dispose = autorun(() => {
      const paint = display.featurePaintInputs
      const { rowIndexByValue, rowColorsByIndex, hiddenColors } =
        display.renderState

      expect(rowIndexByValue).toBe(paint.rowIndexByValue)
      expect(rowColorsByIndex).toBe(paint.rowColorsByIndex)
      expect(hiddenColors).toBe(paint.hiddenColors)
    })
    dispose()
  })
})
