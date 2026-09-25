import { autorun } from 'mobx'

import { collectLegendCandidates } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { createTestEnvironment, ctgA, ctgB } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function regionData(): MultiRowRegionData {
  const packed = {
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
    resolvedPartitionField: 'name',
  }
  return { ...packed, legendCandidates: collectLegendCandidates(packed) }
}

function makeDisplay(displayConfig?: Record<string, unknown>) {
  const { createDisplay } = createTestEnvironment({ displayConfig })
  const { display } = createDisplay()
  display.setRpcData(0, regionData(), ctgA)
  return display
}

// The default palette paints every row, so the legend keys nothing and a
// toggle hides nothing; a `color` slot leaves the baked colours to the legend.
const KEYED = { color: 'steelblue' }

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

describe('encodeInputs', () => {
  // A track-height drag moves `height`, and so `renderState`, every frame, but
  // the instance buffer holds no geometry — that reaches the shader as
  // uniforms.
  it('survives the geometry moving under it', () => {
    const display = makeDisplay()
    const encode = countRecomputes(() => display.encodeInputs)
    const contexts = countRecomputes(() => display.encodedChannels)
    const render = countRecomputes(() => display.renderState)

    display.setRowHeight(14)
    display.setHeight(400)

    expect(render.count()).toBeGreaterThan(1)
    expect(encode.count()).toBe(1)
    expect(contexts.count()).toBe(1)

    encode.dispose()
    contexts.dispose()
    render.dispose()
  })

  // The reader's order, focus and colours are the row table's: none of them
  // reaches the instance buffer.
  it.each([
    [
      'a reorder',
      (d: ReturnType<typeof makeDisplay>) => {
        d.setRowOrder([{ name: 'sampleB' }, { name: 'sampleA' }])
      },
    ],
    [
      'a focus',
      (d: ReturnType<typeof makeDisplay>) => {
        d.setRowFocus(['sampleB'])
      },
    ],
    [
      'a recolor',
      (d: ReturnType<typeof makeDisplay>) => {
        d.applyRowEdits([
          { name: 'sampleA', color: 'red' },
          { name: 'sampleB' },
        ])
      },
    ],
  ])('holds still on %s, which moves the table instead', (_label, mutate) => {
    const display = makeDisplay()
    const encode = countRecomputes(() => display.encodeInputs)
    const table = countRecomputes(() => display.rowTable)

    mutate(display)

    expect(encode.count()).toBe(1)
    expect(table.count()).toBe(2)
    encode.dispose()
    table.dispose()
  })

  // A category toggle drops features out of the buffer, so it re-encodes.
  it('still invalidates on a category toggle', () => {
    const display = makeDisplay(KEYED)
    const encode = countRecomputes(() => display.encodeInputs)

    display.setHiddenCategories(['segA'])

    expect(encode.count()).toBe(2)
    encode.dispose()
  })

  // A row painting an override is exempt from a category hide, so the first
  // override a row takes while a category is hidden changes which features
  // the buffer holds; a change to an override's colour does not. Four rows,
  // because the legend drops an overridden row's colour and keys nothing
  // with one entry left.
  it('re-encodes for a new override only while a category is hidden', () => {
    const { createDisplay } = createTestEnvironment({ displayConfig: KEYED })
    const { display } = createDisplay()
    const names = ['sampleA', 'sampleB', 'sampleC', 'sampleD']
    const packed = {
      featureStarts: new Uint32Array([0, 100, 200, 300]),
      featureEnds: new Uint32Array([100, 200, 300, 400]),
      featureColors: new Uint32Array([
        0xff0000ff, 0xff00ff00, 0xffff0000, 0xff00ffff,
      ]),
      featureDeltas: new Int32Array(0),
      partitionValues: names,
      featurePartitionIndex: new Uint32Array([0, 1, 2, 3]),
      featureNames: ['segA', 'segB', 'segC', 'segD'],
      featureIds: ['a', 'b', 'c', 'd'],
      usedItemRgb: false,
      partitionCandidates: [],
      partitionCandidateValues: [],
      resolvedPartitionField: 'name',
    }
    display.setRpcData(
      0,
      { ...packed, legendCandidates: collectLegendCandidates(packed) },
      ctgA,
    )
    const rows = (colors: Record<string, string>) =>
      names.map(name => ({
        name,
        ...(colors[name] ? { color: colors[name] } : {}),
      }))
    const encode = countRecomputes(() => display.encodeInputs)

    display.applyRowEdits(rows({ sampleA: 'red' }))
    expect(encode.count()).toBe(1)

    display.setHiddenCategories(['segB'])
    expect(encode.count()).toBe(2)

    display.applyRowEdits(rows({ sampleA: 'blue' }))
    expect(encode.count()).toBe(2)

    display.applyRowEdits(rows({ sampleA: 'blue', sampleD: 'red' }))
    expect(encode.count()).toBe(3)
    encode.dispose()
  })

  // The hit test reads `encodedChannels` out of a React event handler, so
  // nothing there is tracked and MobX drops the value as it hands it over.
  // `afterAttach` holds an observer so the cache survives between pointer
  // frames.
  it('stays memoized for an untracked reader', () => {
    const display = makeDisplay(KEYED)

    const first = display.encodedChannels
    expect(display.encodedChannels).toBe(first)

    display.setHiddenCategories(['segA'])
    expect(display.encodedChannels).not.toBe(first)
  })

  // A plain `discoveredRows` getter hands out a fresh array on every write
  // to `rpcDataMap`, and `installUpload` clears its whole encode cache when this
  // identity moves — so region k's arrival re-encodes the byte-identical
  // instance buffer of regions 1..k-1.
  it('survives a second region discovering the rows it already had', () => {
    const display = makeDisplay()
    const encode = countRecomputes(() => display.encodeInputs)

    display.setRpcData(1, regionData(), ctgB)

    expect(encode.count()).toBe(1)
    encode.dispose()
  })

  // A new name takes the next key, which no loaded region carries, so the
  // regions already encoded stay as they are.
  it('holds still when a second region brings a new row', () => {
    const display = makeDisplay()
    const encode = countRecomputes(() => display.encodeInputs)
    const first = display.encodedChannels.get(0)

    display.setRpcData(
      1,
      {
        ...regionData(),
        partitionValues: ['sampleA', 'sampleC'],
      },
      ctgB,
    )

    expect(encode.count()).toBe(1)
    expect(display.encodedChannels.get(0)).toBe(first)
    expect(display.rowKeys.names).toEqual(['sampleA', 'sampleB', 'sampleC'])
    encode.dispose()
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
  // memo's: a resize, a reorder and a focus move nothing, a region landing
  // moves only itself, a category toggle moves every region.
  it('hands the upload the same references the memo holds', () => {
    const display = makeDisplay(KEYED)
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

    display.setRowOrder([{ name: 'sampleB' }, { name: 'sampleA' }])
    display.setRowFocus(['sampleA'])
    display.setRowFocus(undefined)
    expect(uploads).toEqual([0, 1])

    display.setHiddenCategories(['segA'])
    expect(uploads.slice(2).sort()).toEqual([0, 1])
    expect(uploads).toHaveLength(4)

    display.dropLoadedRegion(1)
    expect(releases).toEqual([1])
    expect(uploads).toHaveLength(4)
  })
})

describe('featurePaintInputs', () => {
  // `renderState` must keep carrying all three: the indel-glyph overlay walks
  // the region data in drawn row space under a `renderState`-derived state,
  // and the two agree only while the overlay's inputs are the paint half of
  // it.
  it('is the paint half of renderState, not a second copy of it', () => {
    const display = makeDisplay()
    // Inside a reaction, where MobX actually memoizes a computed: read bare it
    // re-evaluates per access and every identity below would differ for a reason
    // unrelated to the sharing under test.
    const dispose = autorun(() => {
      const paint = display.featurePaintInputs
      const { rowIndexByValue, rowColorsByIndex, hiddenColors, rowTable } =
        display.renderState

      expect(rowIndexByValue).toBe(paint.rowIndexByValue)
      expect(rowColorsByIndex).toBe(paint.rowColorsByIndex)
      expect(hiddenColors).toBe(paint.hiddenColors)
      expect(rowTable).toBe(display.rowTable)
    })
    dispose()
  })
})
