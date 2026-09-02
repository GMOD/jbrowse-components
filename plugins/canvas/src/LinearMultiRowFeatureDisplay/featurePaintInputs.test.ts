import { autorun } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// Two rows, two features, which is enough to make every input to
// `featurePaintInputs` real: a partition list to resolve, a per-row color
// vector to index, and a color that a category toggle could hide.
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
  display.setRpcData(0, regionData())
  return display
}

// `installUpload` memoizes the display's declared `inputs`, so what
// that getter reads decides how often every region's instance buffer is rebuilt.
// This stands in for the helper's computed: the real one needs a GPU backend,
// and what is under test is which observables the encode's input depends on, not
// the upload.
function countRecomputes(read: () => unknown) {
  let n = 0
  const dispose = autorun(() => {
    read()
    n++
  })
  return { count: () => n, dispose }
}

describe('featurePaintInputs', () => {
  // The regression this getter exists for. A track-height drag moves `height`
  // (and so `renderState`) every frame; encoding off `renderState` meant a full
  // pass over every feature of every region, per frame, producing byte-identical
  // output -- the instance buffer holds {startBp,endBp,rowIndex,color} and the
  // geometry reaches the shader as uniforms.
  it('survives the geometry moving under it', () => {
    const display = makeDisplay()
    const paint = countRecomputes(() => display.featurePaintInputs)
    // the hit test's per-region memo, which has the same dependency set and had
    // the same over-invalidation: `featureAt` runs per pointer frame off it
    const contexts = countRecomputes(() => display.drawnFeaturesByRow)
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

  // The other half: the three things that DO change what paints still invalidate
  // it, or a reorder/recolor/toggle would silently keep the old buffer.
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

  // The hit test reads `drawnFeaturesByRow` out of a React event handler, so
  // nothing there is tracked and MobX would drop the value as it handed it
  // over -- every rAF-coalesced mouse move rebuilding every loaded region's row
  // index, which is the walk the memo exists to avoid. `afterAttach` holds an
  // observer so the cache survives between pointer frames.
  it('stays memoized for an untracked reader', () => {
    const display = makeDisplay()

    const first = display.drawnFeaturesByRow
    expect(display.drawnFeaturesByRow).toBe(first)

    display.setLayout([{ name: 'sampleB' }, { name: 'sampleA' }])
    expect(display.drawnFeaturesByRow).not.toBe(first)
  })

  // The progressive-load half of the same regression. A plain
  // `sourcesWithoutLayout` getter handed out a fresh array on every write to
  // `rpcDataMap`, which reaches here — and `installUpload` clears its whole
  // encode cache when this identity moves, so region k's arrival re-encoded and
  // re-uploaded the byte-identical instance buffer of regions 1..k-1. The rows a
  // second region discovers are, on the files this display is pointed at, the
  // rows the first one already had.
  it('survives a second region discovering the rows it already had', () => {
    const display = makeDisplay()
    const paint = countRecomputes(() => display.featurePaintInputs)

    display.setRpcData(1, regionData())

    expect(paint.count()).toBe(1)
    paint.dispose()
  })

  it('still invalidates when a second region brings a new row', () => {
    const display = makeDisplay()
    const paint = countRecomputes(() => display.featurePaintInputs)

    display.setRpcData(1, {
      ...regionData(),
      partitionValues: ['sampleA', 'sampleC'],
    })

    expect(paint.count()).toBe(2)
    paint.dispose()
  })

  // Region k's arrival must not re-walk regions 1..k-1: the bucketing is two
  // full passes over every feature of a region, `rpcDataMap` invalidates the
  // whole computed, and a whole-genome load pays that once per region that
  // lands. Reference identity is the exact statement — a reused index IS the
  // same object.
  it('reuses the already-loaded regions indexes when another region lands', () => {
    const display = makeDisplay()
    const first = display.drawnFeaturesByRow.get(0)

    display.setRpcData(1, regionData())

    expect(display.drawnFeaturesByRow.get(0)).toBe(first)
    expect(display.drawnFeaturesByRow.get(1)).toBeDefined()
  })

  it('rebuilds the region whose data was replaced', () => {
    const display = makeDisplay()
    const first = display.drawnFeaturesByRow.get(0)

    display.setRpcData(0, regionData())

    expect(display.drawnFeaturesByRow.get(0)).not.toBe(first)
  })

  it('drops a region that leaves the map', () => {
    const display = makeDisplay()
    const first = display.drawnFeaturesByRow.get(0)

    display.clearDisplaySpecificData()
    expect(display.drawnFeaturesByRow.size).toBe(0)

    display.setRpcData(0, regionData())
    expect(display.drawnFeaturesByRow.get(0)).not.toBe(first)
  })

  // `renderState` must keep carrying all three, since the Canvas2D fallback and
  // the SVG export resolve each feature's row from the raw region data at draw
  // time. Spreading is what makes that structural rather than remembered.
  it('is the paint half of renderState, not a second copy of it', () => {
    const display = makeDisplay()
    // Inside a reaction, where MobX actually memoizes a computed -- read bare
    // it re-evaluates per access and every identity below would differ for a
    // reason that has nothing to do with the sharing under test.
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
