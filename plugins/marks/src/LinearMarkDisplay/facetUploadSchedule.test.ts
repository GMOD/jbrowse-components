import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type {
  EncodedFeaturesResult,
  FacetSection,
} from '@jbrowse/core/util/markEncoding'

// The installer re-packs every cell whose reference moved, so under a facet
// the remap decides which regions a store write re-uploads.

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function facetedDisplay() {
  const { createDisplay } =
    createDisplayTestEnvironment<LinearMarkDisplayModel>({
      plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
      trackType: 'FeatureTrack',
      adapter: { name: 'BedAdapter', config: { type: 'BedAdapter' } },
      displayName: 'LinearMarkDisplay',
      configSchema: () => configSchemaFactory(),
      stateModel: (pm, schema) => stateModelFactory(pm, schema),
      viewModel: linearGenomeViewStateModelFactory,
      displayConfig: {
        marks: [{ mark: 'bar', encoding: { y: 'score' } }],
        facet: 'sample',
      },
      regions: [REGION],
      assemblyRegions: [REGION],
      onViewReady: view => {
        view.showAllRegions()
      },
    })
  return createDisplay().display
}

// A region's one layer, its instances on `rows`, stacked into `sections`.
function region(
  rows: number[],
  sections: FacetSection[],
): EncodedFeaturesResult {
  const n = rows.length
  return {
    facet: sections,
    layers: [
      {
        count: n,
        skipped: 0,
        x: Uint32Array.from(rows, (_, i) => i * 100),
        x2: Uint32Array.from(rows, (_, i) => i * 100 + 50),
        y: Float32Array.from(rows, (_, i) => i + 1),
        row: Uint32Array.from(rows),
        color: new Uint32Array(n),
        featureIndex: Uint32Array.from(rows, (_, i) => i),
        yMin: 1,
        yMax: n,
      },
    ],
  }
}

// 'a' one row deep and 'b' two, the layout every region below agrees with
// unless it says otherwise.
const TWO_SECTIONS = [
  { key: 'a', firstRow: 0, rowCount: 1 },
  { key: 'b', firstRow: 1, rowCount: 2 },
]

function recordUploads(display: LinearMarkDisplayModel) {
  const uploads: number[] = []
  display.startRenderingBackend({
    upload(key: number) {
      uploads.push(key)
    },
    release() {},
    setErrorHandler() {},
    renderBlocks: () => true,
    dispose() {},
  })
  return uploads
}

test('a region landing under a facet uploads itself, and a region it does not move stays uploaded', () => {
  const display = facetedDisplay()
  const uploads = recordUploads(display)
  display.setRpcData(0, region([0, 1, 2], TWO_SECTIONS), REGION)
  expect(uploads).toEqual([0])

  display.setRpcData(1, region([0, 1], TWO_SECTIONS), REGION)
  expect(uploads).toEqual([0, 1])
  display.setRpcData(2, region([1, 2], TWO_SECTIONS), REGION)
  expect(uploads).toEqual([0, 1, 2])
})

test('a region deepening a section moves every region, and so does hiding one', () => {
  const display = facetedDisplay()
  const uploads = recordUploads(display)
  display.setRpcData(0, region([0, 1, 2], TWO_SECTIONS), REGION)
  display.setRpcData(
    1,
    region(
      [0, 1, 2],
      [
        { key: 'a', firstRow: 0, rowCount: 2 },
        { key: 'b', firstRow: 2, rowCount: 1 },
      ],
    ),
    REGION,
  )
  expect(uploads.slice(1).sort()).toEqual([0, 1])

  display.hideGroup('a')
  expect(uploads.slice(3).sort()).toEqual([0, 1])
  expect(uploads).toHaveLength(5)
})

// A hover reads the drawn map untracked, and the Canvas2D ramp bake is kept on
// the drawn layer.
test('an untracked read hands back the drawn layers the upload holds', () => {
  const display = facetedDisplay()
  recordUploads(display)
  display.setRpcData(0, region([0, 1, 2], TWO_SECTIONS), REGION)
  const drawn = display.rpcDataMap.get(0)
  expect(drawn).toBeDefined()
  expect(display.rpcDataMap.get(0)).toBe(drawn)
  display.setRpcData(1, region([0, 1], TWO_SECTIONS), REGION)
  expect(display.rpcDataMap.get(0)).toBe(drawn)
})
