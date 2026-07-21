import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import {
  BaseDisplay,
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { waitFor } from '@testing-library/react'

import TrackHeightMixin from '../BaseLinearDisplay/models/TrackHeightMixin.tsx'
import { BaseLinearDisplayComponent } from '../index.ts'
import { getTrackOrderSubMenu } from './components/trackLabelMenuItems.ts'
import hg38Regions from './hg38DisplayedRegions.json' with { type: 'json' }
import { stateModelFactory } from './index.ts'
import volvoxDisplayedRegions from './volvoxDisplayedRegions.json' with { type: 'json' }

import type { LinearGenomeViewModel } from './index.ts'
import type { InitState } from './types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

type LGV = LinearGenomeViewModel

// Minimal display state model used as a generic fixture in these LGV unit
// tests (replaces the removed LinearBareDisplay). Composes the surviving
// BaseDisplay + TrackHeightMixin so `type` and `height` behave normally.
function stubDisplayStateModel(configSchema: AnyConfigurationSchemaType) {
  return types.compose(
    'LinearBareDisplay',
    types.compose(BaseDisplay, TrackHeightMixin()),
    types.model({
      type: types.literal('LinearBareDisplay'),
      configuration: ConfigurationReference(configSchema),
    }),
  )
}

// use initializer function to avoid having console.warn jest.fn in a global
function initialize() {
  console.warn = jest.fn()
  console.error = jest.fn()
  // a stub linear genome view state model that only accepts base track types.
  // used in unit tests.
  const stubManager = new PluginManager()
  stubManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'BasicTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(stubManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'BasicTrack',
      configSchema,
      stateModel: createBaseTrackModel(stubManager, 'BasicTrack', configSchema),
    })
  })
  stubManager.addDisplayType(() => {
    const configSchema = ConfigurationSchema(
      'LinearBareDisplay',
      { height: { type: 'number', defaultValue: 100 } },
      { explicitIdentifier: 'displayId', explicitlyTyped: true },
    )
    return new DisplayType({
      name: 'LinearBareDisplay',
      configSchema,
      stateModel: stubDisplayStateModel(configSchema),
      trackType: 'BasicTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
  stubManager.createPluggableElements()
  stubManager.configure()

  const Assembly = types
    .model({
      name: types.maybe(types.string),
    })
    .volatile(() => ({
      regions: volvoxDisplayedRegions,
      initialized: true,
    }))
    .views(() => ({
      // mirrors the real model: resolves an alias or any casing to the
      // canonical name, and returns undefined for a name this assembly lacks.
      // Returning the input unchanged would make every string look like a valid
      // refName, which is what isValidRefName keys off
      getCanonicalRefName(refName: string) {
        const canonical: Record<string, string> = {
          ctga: 'ctgA',
          ctgb: 'ctgB',
          contiga: 'ctgA',
        }
        return canonical[refName.toLowerCase()]
      },
    }))
    .actions(() => ({
      async load() {},
    }))

  const AssemblyManager = types
    .model({
      assemblies: types.map(Assembly),
    })
    .views(self => ({
      get assemblyNameMap() {
        return Object.fromEntries(
          [...self.assemblies.entries()].map(([name, assembly]) => [
            name,
            assembly,
          ]),
        )
      },
    }))
    .actions(self => ({
      isValidRefName(str: string) {
        return str === 'ctgA' || str === 'ctgB'
      },
      get(str: string) {
        return self.assemblies.get(str)
      },

      async waitForAssembly(str: string) {
        return self.assemblies.get(str)
      },
    }))
  const LinearGenomeModel = stateModelFactory(stubManager)
  const Session = types
    .model({
      name: 'testSession',
      rpcManager: 'rpcManagerExists',
      view: types.maybe(LinearGenomeModel),
      // a view held by the session but absent from `views`, so isTopLevelView
      // is false for it (mimics an lgv nested inside another view)
      nestedView: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
      // presence of `widgets` is what isSessionModelWithWidgets keys off, so
      // activateTrackSelector (used by init.tracklist) works in the stub
      widgets: types.map(types.frozen<{ type: string; id: string }>()),
      assemblyManager: types.optional(AssemblyManager, {
        assemblies: {
          volvox: {
            name: 'volvox',
            // @ts-expect-error
            regions: volvoxDisplayedRegions,
          },
        },
      }),
    })
    .views(self => ({
      // isTopLevelView keys off session.views membership; only `view` counts
      get views() {
        return self.view ? [self.view] : []
      },
      getTrackById(_id: string) {
        return undefined
      },
    }))
    .actions(self => ({
      setView(view: LGV) {
        self.view = view
        return view
      },
      setNestedView(view: LGV) {
        self.nestedView = view
        return view
      },
      notifyError(message: string, _error?: unknown) {
        console.error(message)
      },
      addWidget(typeName: string, id: string) {
        const widget = { type: typeName, id }
        self.widgets.set(id, widget)
        return widget
      },
      showWidget() {},
      hideWidget() {},
    }))

  return { Session, LinearGenomeModel, Assembly }
}

// Multi-region zoom: inter-region padding contributes paddingWidth * bpPerPx
// of virtual-bp per gutter, so the naive (offsetPx + cursor_x) * bpPerPx zoom
// anchor drifts ~numPaddings * paddingWidth * Δ(bpPerPx) bp per zoom step.
// Bug isn't flipped-specific — flipping just makes it visible.
describe.each([
  { name: 'unflipped', reversed: false },
  { name: 'flipped', reversed: true },
])(
  'zoomTo anchors on cursor bp in multi-region view ($name)',
  ({ reversed }) => {
    it('preserves bp under cursor across zoom steps', () => {
      const { Session, LinearGenomeModel } = initialize()
      const model = Session.create({ configuration: {} }).setView(
        LinearGenomeModel.create({
          id: `testMultiZoom-${reversed}`,
          type: 'LinearGenomeView',
          tracks: [{ name: 'foo', type: 'BasicTrack' }],
        }),
      )
      model.setWidth(800)
      model.setDisplayedRegions([
        {
          assemblyName: 'volvox',
          refName: 'ctgA',
          start: 0,
          end: 1e6,
          reversed,
        },
        {
          assemblyName: 'volvox',
          refName: 'ctgB',
          start: 0,
          end: 1e6,
          reversed,
        },
        {
          assemblyName: 'volvox',
          refName: 'ctgA',
          start: 0,
          end: 1e6,
          reversed,
        },
      ])
      model.setNewView(500, 1000)

      const before = model.pxToBp(600)
      expect(before.oob).toBe(false)
      for (const d of [-0.05, -0.05, -0.05, -0.05]) {
        model.zoomTo(model.bpPerPx / (1 - d), 600)
      }
      const after = model.pxToBp(600)
      expect(after.refName).toEqual(before.refName)
      expect(after.index).toEqual(before.index)
      expect(Math.abs(after.coord - before.coord)).toBeLessThan(model.bpPerPx)
    })
  },
)

// Diagnostic: simulate a 30-frame scroll-zoom burst at a fixed cursor offset
// and dump the cursor's bp position each frame. Used to characterize the
// per-frame judder the user reports — fails if drift exceeds a tight bound,
// so the numbers show up in the failure output.
describe('scroll-zoom diagnostic — cursor bp stability across frames', () => {
  it.each([
    { name: 'single-region zoom-in at bpPerPx=10', start: 10, sign: 1 },
    { name: 'single-region zoom-out at bpPerPx=10', start: 10, sign: -1 },
    { name: 'single-region zoom-in at bpPerPx=1', start: 1, sign: 1 },
    { name: 'multi-region zoom-in at bpPerPx=500', start: 500, sign: 1 },
  ])('$name', ({ start, sign }) => {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        id: `diag-${start}-${sign}`,
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo', type: 'BasicTrack' }],
      }),
    )
    model.setWidth(800)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1e6 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 1e6 },
    ])
    model.setNewView(start, 1000)

    const cursorPx = 600
    const initial = model.pxToBp(cursorPx)
    const samples: { bpPerPx: number; coord: number }[] = []

    // mimic wheel handler: zoomAccum capped at MAX_ZOOM_RATE_PER_MS * 16.67 ≈ 0.2
    const d = sign * 0.05
    const ratio = d > 0 ? 1 + d : 1 / (1 - d)
    for (let frame = 0; frame < 30; frame++) {
      model.zoomTo(model.bpPerPx * ratio, cursorPx)
      samples.push({
        bpPerPx: model.bpPerPx,
        coord: model.pxToBp(cursorPx).coord,
      })
    }

    const maxDriftPx = Math.max(
      ...samples.map(s => Math.abs(s.coord - initial.coord) / s.bpPerPx),
    )
    // Pre-fix: monotonic drift up to ~5 px at bpPerPx=1, frame-to-frame
    // oscillation up to ~1.5 px at higher bpPerPx. With the float-offset +
    // unrounded-scrollTo fixes, residual drift is < 1 bp / sub-pixel.
    expect(maxDriftPx).toBeLessThan(0.2)
  })
})

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )

  expect(model.tracks[0]).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
})

test('can instantiate a model that lets you navigate', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test1',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
  ])
  expect(model.maxBpPerPx).toBeCloseTo(13.888)
  model.setNewView(0.02, 0)

  expect(model.scalebarHeight).toEqual(20)
  // header height 20 + area where polygons get drawn has height of 48
  expect(model.headerHeight).toEqual(68)
  // TODO: figure out how to better test height
  // expect(model.height).toBe(191)
  // test some sanity values from zooming around
  model.setNewView(0.02, 0)
  expect(model.pxToBp(10).offset).toEqual(0.2)
  model.setNewView(0.1, 0)
  expect(model.pxToBp(100).offset).toEqual(10)
  model.setNewView(1, 0)
  expect(model.pxToBp(100).offset).toEqual(100)
  model.setNewView(10, 0)
  expect(model.pxToBp(100).offset).toEqual(1000)

  model.horizontallyFlip()

  // this is actually the same in reverse mode, the offset is a representation of linear bp offset not actual bp
  model.setNewView(0.02, 0)
  expect(model.pxToBp(10).offset).toEqual(0.2)
  model.setNewView(0.1, 0)
  expect(model.pxToBp(100).offset).toEqual(10)
  model.setNewView(1, 0)
  expect(model.pxToBp(100).offset).toEqual(100)
  model.setNewView(10, 0)
  expect(model.pxToBp(100).offset).toEqual(1000)
})

test('maxBpPerPx never drops below minBpPerPx for tiny regions', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test-tiny-region',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  // 10bp region: totalBp / (width * 0.9) = 10 / 720 ≈ 0.0139, below the
  // MIN_BP_PER_PX floor of 0.02, so without the floor the zoom slider bounds
  // and zoomTo clamp range would invert.
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10, refName: 'ctgA' },
  ])
  expect(model.maxBpPerPx).toBeGreaterThanOrEqual(model.minBpPerPx)
  expect(model.maxBpPerPx).toBe(model.minBpPerPx)
})

test.each([
  ['empty', ''],
  ['whitespace', '   '],
])(
  'navToLocString(%s) does not blank a populated view',
  async (_name, input) => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({
        id: `no-blank-${_name}`,
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'BasicTrack' }],
      }),
    )
    model.setWidth(800)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])
    const before = model.displayedRegions.length

    await model.navToLocString(input)

    expect(model.displayedRegions.length).toBe(before)
    expect(model.displayedRegions[0]!.refName).toBe('ctgA')
  },
)

test('navToLocations([]) is a no-op and does not blank the view', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'no-blank-empty-locations',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
  ])

  await model.navToLocations([])

  expect(model.displayedRegions.length).toBe(1)
  expect(model.displayedRegions[0]!.refName).toBe('ctgA')
})

test('can instantiate a model that has multiple displayed regions', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test2',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
  ])
  expect(model.maxBpPerPx).toBeCloseTo(27.778)
  model.setNewView(0.02, 0)

  expect(model.offsetPx).toEqual(0)
  model.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
  expect(model.offsetPx).toEqual(800)
  model.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
  expect(model.offsetPx).toEqual(79600)
})

test('can instantiate a model that tests navTo/moveTo', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test3',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(width)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
  ])
  expect(model.maxBpPerPx).toBeCloseTo(27.778)

  model.navTo({ refName: 'ctgA', start: 0, end: 100 })
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBe(0.125)

  model.navTo({ refName: 'ctgA' })
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBe(12.5)

  model.navTo({ refName: 'contigA', start: 0, end: 100 })
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBe(0.125)

  expect(() => {
    model.navTo({ refName: 'ctgA', start: 200, end: 100 })
  }).toThrow(/start greater than end/)

  expect(() => {
    model.navTo({ refName: 'noExist', start: 0, end: 100 })
  }).toThrow(/could not find a region/)

  expect(() => {
    model.navTo({ refName: 'ctgA', end: 20100 })
  }).toThrow(/could not find a region/)

  expect(() => {
    model.navTo({ refName: 'ctgA', start: 20000 })
  }).toThrow(/could not find a region/)

  expect(() => {
    model.navTo({ refName: 'ctgA', start: 20000, end: 20100 })
  }).toThrow(/could not find a region/)

  expect(() => {
    model.navTo({ refName: 'ctgA', start: 0, end: 20000 })
  }).toThrow(/could not find a region/)
})

test('can navToMultiple', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'testNavToMultiple',
      type: 'LinearGenomeView',
    }),
  )
  model.setWidth(width)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 10000 },
    { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 10000 },
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
    { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 10000 },
  ])

  model.navToMultiple([{ refName: 'ctgA', start: 0, end: 10000 }])
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBe(12.5)

  model.navToMultiple([
    { refName: 'ctgA', start: 5000, end: 10000 },
    { refName: 'ctgB', start: 0, end: 5000 },
  ])
  expect(model.offsetPx).toBe(400)
  expect(model.bpPerPx).toBeCloseTo(12.5)

  model.navToMultiple([
    { refName: 'ctgA', start: 5000, end: 10000 },
    { refName: 'ctgB', start: 0, end: 10000 },
    { refName: 'ctgC', start: 0, end: 5000 },
  ])
  expect(model.offsetPx).toBe(200)
  expect(model.bpPerPx).toBeCloseTo(25)

  model.navToMultiple([
    { refName: 'ctgA', start: 5000, end: 10000 },
    { refName: 'ctgC', start: 0, end: 5000 },
  ])
  expect(model.offsetPx).toBe(200)
  expect(model.bpPerPx).toBeCloseTo(25)
})

// when a refName appears twice with different bounds and the navigated
// location omits start/end, the default coords must come from the same
// (first) occurrence that the index resolution picks, else navigation lands
// on the wrong sub-interval
test('navTo with omitted coords on a duplicated refName', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'testNavToDuplicateRefName',
      type: 'LinearGenomeView',
    }),
  )
  model.setWidth(width)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 10000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 10000 },
    { assemblyName: 'volvox', refName: 'ctgC', start: 2000, end: 8000 },
  ])

  // shows the full first ctgC (0-10000), not 0-8000 borrowed from the second
  model.navTo({ refName: 'ctgC' })
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBeCloseTo(12.5)
})

describe('Zoom to selected displayed regions', () => {
  const { Session, LinearGenomeModel } = initialize()
  let model: LGV
  beforeEach(() => {
    const session = Session.create({
      configuration: {},
    })
    const width = 800
    model = session.setView(
      LinearGenomeModel.create({
        id: 'testZoomToDisplayed',
        type: 'LinearGenomeView',
      }),
    )
    model.setWidth(width)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 5000, end: 20000 },
      { assemblyName: 'volvox', refName: 'ctgA', start: 30000, end: 40000 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 3000 },
    ])
  })

  it('can select whole region', () => {
    // should have no offset and largest bpPerPx
    expect(model.offsetPx).toBe(0)
    expect(model.bpPerPx).toEqual(1)
    // 'ctgA' 15000  bp+ 'ctgA' 10000 bp+ 'ctgB' 3000 bp = 28000 totalbp
    expect(model.totalBp).toEqual(28000)

    model.moveTo(
      {
        start: 5000,
        index: 0,
        end: 20000,
        coord: 5001,
        offset: 0,
        refName: 'ctgA',
      },
      {
        start: 0,
        index: 2,
        coord: 1,
        end: 3000,
        offset: 1,
        refName: 'ctgB',
      },
    )

    expect(model.offsetPx).toEqual(0)
    expect(model.bpPerPx).toBeCloseTo(31.251)
  })

  it('can select over one refSeq', () => {
    model.moveTo(
      {
        start: 5000,
        index: 0,
        end: 20000,
        coord: 5001,
        offset: 0,
        refName: 'ctgA',
      },
      {
        start: 5000,
        index: 0,
        coord: 10000,
        end: 20000,
        offset: 5000,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toEqual(0)
    // 10000 - 5000 = 5000 / 800 = 6.25
    expect(model.bpPerPx).toEqual(6.25)
  })

  it('can select one region with start or end outside of displayed region', () => {
    model.moveTo(
      {
        start: 5000,
        index: 0,
        end: 20000,
        coord: 4999,
        offset: -1,
        refName: 'ctgA',
      },
      {
        start: 5000,
        index: 0,
        end: 20000,
        coord: 19000,
        offset: 19000,
        refName: 'ctgA',
      },
    )
    // offsetPx is still 0 since we are starting from the first coord
    // needed Math.abs since it was giving negative-zero (-0)
    expect(Math.abs(model.offsetPx)).toEqual(0)
    // endOffset 19000 - (-1) = 19001 /  800 = zoomTo(23.75)
    expect(model.bpPerPx).toBeCloseTo(23.75)
  })

  it('can select over two regions in the same reference sequence', () => {
    model.setWidth(800)
    model.showAllRegions()
    expect(model.bpPerPx).toBeCloseTo(38.889)
    model.moveTo(
      {
        start: 5000,
        index: 0,
        end: 20000,
        offset: 5000,
        refName: 'ctgA',
      },
      {
        start: 0,
        index: 2,
        end: 3000,
        offset: 2000,
        refName: 'ctgB',
      },
    )
    expect(model.bpPerPx).toBeCloseTo(27.5)
    expect(model.offsetPx).toBe(182)
  })

  it('can navigate to overlapping regions with a region between', () => {
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 5000, end: 20000 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 3000 },
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 35000 },
    ])
    model.setWidth(800)
    model.showAllRegions()
    // totalBp 15000 + 3000 + 35000 = 53000
    expect(model.bpPerPx).toBeCloseTo(73.611)
    model.moveTo(
      {
        start: 5000,
        coord: 15000,
        index: 0,
        end: 20000,
        offset: 10000,
        refName: 'ctgA',
      },
      {
        start: 0,
        coord: 15000,
        index: 2,
        end: 35000,
        offset: 15000,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(348)
    expect(model.bpPerPx).toBeCloseTo(28.75)
    expect(model.bpPerPx).toBeLessThan(53)
  })
})

test('can instantiate a model that >2 regions', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test4',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(width)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgC' },
  ])
  model.moveTo({ index: 0, offset: 100 }, { index: 2, offset: 100 })
  model.setNewView(1, 0)

  // extending in the minus gives us first displayed region
  expect(model.pxToBp(-5000).refName).toEqual('ctgA')
  expect(model.pxToBp(5000).refName).toEqual('ctgA')
  expect(model.pxToBp(15000).refName).toEqual('ctgB')
  expect(model.pxToBp(25000).refName).toEqual('ctgC')
  // extending past gives us the last displayed region
  expect(model.pxToBp(35000).refName).toEqual('ctgC')

  model.setDisplayName('Volvox view')
  expect(model.displayName).toBe('Volvox view')
  model.moveTo(
    { refName: 'ctgA', index: 0, offset: 0, start: 0, end: 10000 },
    { refName: 'ctgC', index: 2, offset: 0, start: 0, end: 10000 },
  )
  model.moveTo(
    { refName: 'ctgB', index: 1, offset: 0, start: 0, end: 10000 },
    { refName: 'ctgC', index: 2, offset: 0, start: 0, end: 10000 },
  )
  expect(model.offsetPx).toEqual(10000 / model.bpPerPx)
  expect(model.displayedRegionsTotalPx).toBeCloseTo(30000 / model.bpPerPx)
  model.showAllRegions()
  expect(model.offsetPx).toEqual(-40)

  expect(model.bpToPx({ refName: 'ctgA', coord: 100 })).toEqual({
    index: 0,
    offsetPx: Math.round(100 / model.bpPerPx),
  })

  expect(model.bpToPx({ refName: 'ctgB', coord: 100 })).toEqual({
    index: 1,
    offsetPx: Math.round(10100 / model.bpPerPx),
  })
})

test('can perform bpToPx in a way that makes sense on things that happen outside', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test5',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(width)
  model.setDisplayedRegions([
    {
      assemblyName: 'volvox',
      start: 1000,
      end: 2000,
      refName: 'ctgA',
      reversed: true,
    },
  ])

  expect(model.bpToPx({ refName: 'ctgA', coord: 500 })).toBe(undefined)
  expect(model.pxToBp(-1).coord).toEqual(2002)
  expect(model.pxToBp(100).offset).toEqual(100)
  expect(model.pxToBp(100).coord).toEqual(1901)
  // testing bpToPx and pxToBp when region is reversed

  // coordinate is out of bounds
  expect(model.bpToPx({ refName: 'ctgA', coord: 0 })).toEqual(undefined)
  expect(model.bpToPx({ refName: 'ctgA', coord: 2001 })).toEqual(undefined)

  // offset here should be 500 because coord 1500 - 1000 start = 500
  expect(model.bpToPx({ refName: 'ctgA', coord: 1500 })).toEqual({
    index: 0,
    offsetPx: 500,
  })
  expect(model.pxToBp(-1).oob).toEqual(true)

  model.centerAt(1500, 'ctgA', 0)
  expect(model.bpPerPx).toEqual(1)
  expect(model.offsetPx).toEqual(100)

  model.setError(new Error('pxToBp failed to map to a region'))
  expect(`${model.error}`).toEqual('Error: pxToBp failed to map to a region')
})

// Renderer-level reversed tests (alignments reversedMirror.test.ts) hand
// `reversed: true` straight to the render path — they can't prove the *model*
// delivers one. The wiring is `displayedRegion.reversed` →
// `dynamicBlocks.contentBlocks` → `view.visibleRegions` → `buildRenderBlocks`
// (the shared getter every GPU display's render call reads via
// MultiRegionDisplayMixin.renderBlocks). This pins that whole chain, so a
// display can't silently render a flipped region forward. The alignments-
// specific counterpart is ReversedAlignmentsBlocks.test.tsx (jbrowse-web).
describe('displayedRegion.reversed → buildRenderBlocks wiring', () => {
  function renderBlocksFor(reversed: boolean) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        id: `renderblock-wiring-${reversed}`,
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo', type: 'BasicTrack' }],
      }),
    )
    model.setWidth(800)
    model.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 1000,
        end: 2000,
        reversed,
      },
    ])
    return buildRenderBlocks(model.visibleRegions)
  }

  it('a forward displayedRegion delivers reversed:false blocks', () => {
    const blocks = renderBlocksFor(false)
    expect(blocks.length).toBeGreaterThan(0)
    // reversed is `reversed?: boolean` on the input but resolved (always
    // present) on a RenderBlock — the render path branches on it directly.
    expect(blocks.every(b => !b.reversed)).toBe(true)
  })

  it('a reversed displayedRegion delivers reversed:true blocks', () => {
    const blocks = renderBlocksFor(true)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.every(b => b.reversed)).toBe(true)
  })

  it('flipping changes only orientation: same pixel rect, same bp width', () => {
    // A flip must not resize the block or move the pixel rect it paints into —
    // it only mirrors the bp→x mapping (and, at the default view, anchors on the
    // region's other end, so the visible sub-span differs but its *width* can't).
    // If flipping also changed the rect or the bp-width, a downstream cull /
    // mapper would be fed inconsistent inputs.
    const fwd = renderBlocksFor(false)
    const rev = renderBlocksFor(true)
    expect(rev.length).toBe(fwd.length)
    fwd.forEach((f, i) => {
      const r = rev[i]!
      expect(r.screenStartPx).toBe(f.screenStartPx)
      expect(r.screenEndPx).toBe(f.screenEndPx)
      expect(r.end - r.start).toBe(f.end - f.start)
      expect(r.displayedRegionIndex).toBe(f.displayedRegionIndex)
      expect(r.reversed).toBe(!f.reversed)
    })
  })
})

// determined objectively by looking at
// http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-Se2K5q_Jog&password=qT9on
//
// this test is important because interregionpadding blocks outside the current
// view should not be taken into account
test('can perform pxToBp on human genome things with elided blocks (zoomed in)', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test6',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  const width = 800
  model.setWidth(width)
  model.setDisplayedRegions(hg38Regions)
  model.setNewView(6359.273152497633, 503862)
  expect(model.pxToBp(0).refName).toBe('Y')
  expect(model.pxToBp(400).refName).toBe('Y')
  expect(model.pxToBp(800).refName).toBe('Y_KI270740v1_random')
})

// determined objectively from looking at http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-TUJdqKI2c9&password=01tan
//
// this tests some places on hg38 when zoomed to whole genome, so inter-region
// padding blocks and elided blocks matter
test('can perform pxToBp on human genome things with elided blocks (zoomed out)', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test6',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  const width = 800
  model.setWidth(width)
  model.setDisplayedRegions(hg38Regions)
  model.setNewView(3209286.105, -225.5083315372467)
  // chr1 to the left
  expect(model.pxToBp(0).refName).toBe('1')
  expect(model.pxToBp(0).oob).toBeTruthy()
  // chr11 in the middle
  expect(model.pxToBp(800).coord).toBe(35027079)
  expect(model.pxToBp(800).refName).toBe('11')

  // past end of genome without inter-region padding
  expect(model.pxToBp(1228).refName).toBe('Y_KI270740v1_random')
  expect(model.pxToBp(1228).oob).toBeTruthy()

  // chrY_random at the end
  expect(model.pxToBp(1500).refName).toBe('Y_KI270740v1_random')
  expect(model.pxToBp(1500).oob).toBeTruthy()
})

test('can showAllRegionsInAssembly', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test4',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(width)
  model.showAllRegionsInAssembly('volvox')
  expect(model.displayedRegions.map(reg => reg.refName)).toEqual([
    'ctgA',
    'ctgB',
  ])
})

test('init without loc shows whole genome', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'testInitNoLoc',
      type: 'LinearGenomeView',
      init: {
        assembly: 'volvox',
      },
    }),
  )
  model.setWidth(width)
  await waitFor(() => {
    expect(model.displayedRegions.map(reg => reg.refName)).toEqual([
      'ctgA',
      'ctgB',
    ])
  })
})

test('init with loc keeps loading until navigation populates regions', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'testInitPending',
      type: 'LinearGenomeView',
      init: {
        assembly: 'volvox',
        loc: 'ctgA:1-100',
      },
    }),
  )
  model.setWidth(800)

  // navToLocString awaits the assembly asynchronously, so right after setWidth
  // the assembly is initialized but displayedRegions is still empty. The
  // container must not mount in this window (its hover pxToBp throws on empty
  // regions) — showLoading has to stay true, not fall through to the view.
  expect(model.initialized).toBe(true)
  expect(model.hasDisplayedRegions).toBe(false)
  expect(model.initPending).toBe(true)
  expect(model.showLoading).toBe(true)
  expect(model.showImportForm).toBe(false)

  await waitFor(() => {
    expect(model.hasDisplayedRegions).toBe(true)
  })
  expect(model.initPending).toBe(false)
  expect(model.showLoading).toBe(false)
})

describe('get sequence for selected displayed regions', () => {
  const { Session, LinearGenomeModel } = initialize()
  /* the start of all the results should be +1
  the sequence dialog then handles converting from 1-based closed to interbase
  */
  let model: LGV
  beforeEach(() => {
    const session = Session.create({
      configuration: {},
    })
    const width = 800
    model = session.setView(
      LinearGenomeModel.create({
        id: 'testGetSequenceSelectedRegions',
        type: 'LinearGenomeView',
      }),
    )
    model.setWidth(width)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50001 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 6079 },
    ])
  })

  it('can select whole region and handles both offsets being oob', () => {
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 800 },
    ])
    model.setOffsets(
      {
        refName: 'ctgA',
        index: 0,
        offset: -10,
        start: 0,
        end: 800,
        coord: -10,
        reversed: false,
        assemblyName: 'volvox',
        oob: true,
      },
      {
        refName: 'ctgA',
        index: 0,
        offset: 810,
        start: 0,
        end: 800,
        coord: 810,
        reversed: false,
        assemblyName: 'volvox',
        oob: true,
      },
    )
    const singleRegion = model.getSelectedRegions(
      model.leftOffset,
      model.rightOffset,
    )
    expect(singleRegion.length).toEqual(1)
    expect(singleRegion[0]!.start).toEqual(0)
    expect(singleRegion[0]!.end).toEqual(800)
  })
  it('handles when both offsets are before the start of all regions', () => {
    model.setOffsets(
      {
        refName: 'ctgA',
        start: 0,
        end: 50001,
        reversed: false,
        assemblyName: 'volvox',
        oob: true,
        coord: -8,
        offset: -8.77999706864357,
        index: 0,
      },
      {
        refName: 'ctgA',
        start: 0,
        end: 50001,
        reversed: false,
        assemblyName: 'volvox',
        oob: true,
        coord: -4,
        offset: -4.12999706864357,
        index: 0,
      },
    )
    const result = model.getSelectedRegions(model.leftOffset, model.rightOffset)
    expect(result.length).toEqual(1)
    expect(result[0]!.refName).toEqual('ctgA')
    expect(result[0]!.start).toEqual(0)
  })

  it('handles when both offsets are past the end of all regions', () => {
    const oobAfter = {
      refName: 'ctgB',
      start: 0,
      end: 6079,
      reversed: false as const,
      assemblyName: 'volvox',
      oob: true,
      index: 1,
    }
    const result = model.getSelectedRegions(
      { ...oobAfter, offset: 7000, coord: 7001 },
      { ...oobAfter, offset: 8000, coord: 8001 },
    )
    expect(result.length).toEqual(1)
    expect(result[0]!.refName).toEqual('ctgB')
    expect(result[0]!.end).toEqual(6079)
  })

  it('selects multiple regions with a region in between', () => {
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 500 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 3000 },
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 200 },
    ])
    model.setWidth(800)
    model.showAllRegions()

    // created by console logging getSelectedRegion's arguments after manually
    // setting up this test case in the browser
    model.setOffsets(
      {
        refName: 'ctgA',
        start: 0,
        end: 500,
        reversed: false,
        assemblyName: 'volvox',
        oob: false,
        offset: 200,
        coord: 200,
        index: 0,
      },
      {
        refName: 'ctgA',
        start: 0,
        end: 200,
        reversed: false,
        assemblyName: 'volvox',
        oob: false,
        offset: 100,
        coord: 100,
        index: 2,
      },
    )
    const overlapping = model.getSelectedRegions(
      model.leftOffset,
      model.rightOffset,
    )
    expect(overlapping.length).toEqual(3)
    expect(overlapping[0]!.start).toEqual(199)
    expect(overlapping[0]!.end).toEqual(500)
    expect(overlapping[1]!.start).toEqual(0)
    expect(overlapping[1]!.end).toEqual(3000)
    expect(overlapping[2]!.start).toEqual(0)
    expect(overlapping[2]!.end).toEqual(100)
  })

  it('can select over two regions in diff reference sequence', () => {
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50001 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 6079 },
    ])
    model.setOffsets(
      {
        refName: 'ctgA',
        index: 0,
        offset: 49998,
        start: 0,
        end: 50001,
        coord: 49999,
        reversed: false,
        assemblyName: 'volvox',
        oob: false,
      },
      {
        refName: 'ctgB',
        index: 1,
        offset: 9,
        start: 0,
        end: 6079,
        coord: 10,
        reversed: false,
        assemblyName: 'volvox',
        oob: false,
      },
    )
    const multipleRegions = model.getSelectedRegions(
      model.leftOffset,
      model.rightOffset,
    )
    expect(multipleRegions.length).toEqual(2)
    expect(multipleRegions[0]!.start).toEqual(49998)
    expect(multipleRegions[0]!.end).toEqual(50001)
    expect(multipleRegions[1]!.start).toEqual(0)
    expect(multipleRegions[1]!.end).toEqual(9)
  })

  it('can handle horizontally flipped regions', () => {
    model.setDisplayedRegions([
      {
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 50001,
        reversed: true,
      },
    ])
    const hfRegion = model.getSelectedRegions(
      {
        refName: 'ctgA',
        start: 0,
        end: 50001,
        reversed: true,
        assemblyName: 'volvox',
        oob: false,
        offset: 1.03696711063385,
        coord: 50000,
        index: 0,
      },
      {
        refName: 'ctgA',
        start: 0,
        end: 50001,
        reversed: true,
        assemblyName: 'volvox',
        oob: false,
        offset: 3.93696711063385,
        coord: 49998,
        index: 0,
      },
    )

    expect(hfRegion.length).toEqual(1)
    expect(hfRegion[0]!.start).toEqual(49997)
    expect(hfRegion[0]!.end).toEqual(50000)
  })
})

test('navToLocString with human assembly', async () => {
  const { LinearGenomeModel } = initialize()
  const HumanAssembly = types
    .model({})
    .volatile(() => ({
      regions: hg38Regions,
    }))
    .views(() => ({
      // hg38 fixture refNames are unprefixed ('1'), so 'chr1' is an alias of
      // '1'; undefined for anything the assembly lacks, as the real model does
      getCanonicalRefName(refName: string) {
        const name = refName.replace('chr', '')
        return hg38Regions.some(r => r.refName === name) ? name : undefined
      },
    }))
    .actions(() => ({
      async load() {},
    }))
  const AssemblyManager = types
    .model({
      assemblies: types.map(HumanAssembly),
    })
    .actions(self => ({
      isValidRefName(str: string) {
        return !str.includes(':')
      },
      get(str: string) {
        return self.assemblies.get(str)
      },

      async waitForAssembly(str: string) {
        return self.assemblies.get(str)
      },
    }))

  const HumanSession = types.model({
    name: 'testSession',
    rpcManager: 'rpcManagerExists',
    configuration: types.map(types.string),
    assemblyManager: AssemblyManager,
    view: LinearGenomeModel,
  })

  const model = HumanSession.create({
    configuration: {},
    assemblyManager: {
      assemblies: {
        hg38: {
          // @ts-expect-error
          regions: hg38Regions,
        },
      },
    },
    view: {
      type: 'LinearGenomeView',
    },
  })
  const { view } = model

  view.setWidth(800)
  view.setDisplayedRegions(hg38Regions.slice(0, 1))
  const w = view.width

  await view.navToLocString('2')
  await waitFor(() => {
    expect(view.bpPerPx).toBe(hg38Regions[1]!.end / w)
  })

  await view.navToLocString('chr3')
  await waitFor(() => {
    expect(view.bpPerPx).toBe(hg38Regions[2]!.end / w)
  })

  await view.navToLocString('chr3:1,000,000,000-1,100,000,000')
  await waitFor(() => {
    expect(view.bpPerPx).toBe(0.02)
  })
  await waitFor(() => {
    expect(view.offsetPx).toBe(9914777550)
  })
  await view.navToLocString('chr3:-1,100,000,000..-1,000,000,000')
})

test('multi region', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions(volvoxDisplayedRegions.slice(0, 1))

  await model.navToLocString('ctgA ctgB')
  await waitFor(() => {
    expect(model.displayedRegions[0]!.refName).toBe('ctgA')
  })
  await waitFor(() => {
    expect(model.displayedRegions[1]!.refName).toBe('ctgB')
  })
})

test('space separated locstring', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions(volvoxDisplayedRegions.slice(0, 1))

  await model.navToLocString('ctgA 0 100')
  await waitFor(() => {
    expect(model.offsetPx).toBe(0)
  })
  await waitFor(() => {
    expect(model.bpPerPx).toBe(0.125)
  })
})

test('unresolved gene name reports a clean no-results error', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions(volvoxDisplayedRegions.slice(0, 1))

  await expect(model.navToLocString('nonexistentgene')).rejects.toThrow(
    /No results found for "nonexistentgene"/,
  )
})

test('unknown-ref coordinate query keeps the specific ref error', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'BasicTrack' }],
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions(volvoxDisplayedRegions.slice(0, 1))

  await expect(model.navToLocString('badref:100-200')).rejects.toThrow(
    /unknown reference sequence/,
  )
})

test('showLoading is true when displayedRegions are set but not yet initialized', () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      displayedRegions: [
        { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
      ],
      bpPerPx: 1,
      offsetPx: 0,
    }),
  )
  // width not set yet, so not initialized
  expect(model.showLoading).toBe(true)
  expect(model.initialized).toBe(false)

  // after setting width, should be initialized
  model.setWidth(800)
  expect(model.showLoading).toBe(false)
  expect(model.initialized).toBe(true)
})

test('showLoading is true when init is set and becomes false after initialization', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      init: {
        assembly: 'volvox',
        loc: 'ctgA:1000-2000',
      },
    }),
  )
  // not initialized yet, so showLoading should be true
  expect(model.showLoading).toBe(true)
  expect(model.initialized).toBe(false)

  model.setWidth(800)
  // after init autorun processes and view initializes, showLoading should become false
  await waitFor(() => {
    expect(model.showLoading).toBe(false)
  })
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  expect(console.error).not.toHaveBeenCalled()
})

test('showAllRegions centers correctly with multiple regions', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
        { assemblyName: 'volvox', refName: 'ctgA', start: 2000, end: 3000 },
        { assemblyName: 'volvox', refName: 'ctgA', start: 4000, end: 5000 },
      ],
    }),
  )

  model.setWidth(900)
  model.showAllRegions()

  // Total BP = 3000, bpPerPx = 3000 / (900 * 0.9) = 3000 / 810 = 3.704
  // totalContentPx = 3000 / 3.704 = 810, centerPx = 405, offsetPx = 405 - 450 = -45
  expect(model.bpPerPx).toBeCloseTo(3.704, 2)
  expect(model.offsetPx).toBe(-45)
})

test('showAllRegions with single region has no padding adjustment', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
      ],
    }),
  )

  model.setWidth(900)
  model.showAllRegions()

  // Single region = 0 paddings
  // bpPerPx = 1000 / (900 * 0.9) = 1.234567
  // totalContentPx = 1000 / 1.234567 + 0 = 810
  // centerPx = 405, offsetPx = 405 - 450 = -45

  expect(model.bpPerPx).toBeCloseTo(1.2346, 3)
  expect(model.offsetPx).toBe(-45)
})

describe('TrackInit with display configuration', () => {
  function initializeWithTracks() {
    console.warn = jest.fn()
    console.error = jest.fn()
    const stubManager = new PluginManager()

    // Add a track type
    stubManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'BasicTrack',
        {},
        {
          baseConfiguration: createBaseTrackConfig(stubManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'BasicTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          stubManager,
          'BasicTrack',
          configSchema,
        ),
      })
    })

    // Add view type (must be before display types so they get linked)
    stubManager.addViewType(() => {
      return new ViewType({
        name: 'LinearGenomeView',
        stateModel: stateModelFactory(stubManager),
        ReactComponent: () => null,
      })
    })

    // Add display type
    stubManager.addDisplayType(() => {
      const configSchema = ConfigurationSchema(
        'LinearBareDisplay',
        { height: { type: 'number', defaultValue: 100 } },
        { explicitIdentifier: 'displayId', explicitlyTyped: true },
      )
      return new DisplayType({
        name: 'LinearBareDisplay',
        configSchema,
        stateModel: stubDisplayStateModel(configSchema),
        trackType: 'BasicTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    stubManager.createPluggableElements()
    stubManager.configure()

    const Assembly = types
      .model({})
      .volatile(() => ({
        regions: volvoxDisplayedRegions,
        initialized: true,
      }))
      .views(() => ({
        // undefined for a name this assembly lacks, as the real model does
        getCanonicalRefName(refName: string) {
          const canonical: Record<string, string> = {
            ctga: 'ctgA',
            ctgb: 'ctgB',
          }
          return canonical[refName.toLowerCase()]
        },
      }))

    const AssemblyManager = types
      .model({
        assemblies: types.map(Assembly),
      })
      .actions(self => ({
        isValidRefName(str: string) {
          return str === 'ctgA' || str === 'ctgB'
        },
        get(str: string) {
          return self.assemblies.get(str)
        },

        async waitForAssembly(str: string) {
          return self.assemblies.get(str)
        },
      }))

    const LinearGenomeModel = stateModelFactory(stubManager)

    // Track configurations that the session knows about
    const trackConfigs: Record<string, { type: string; trackId: string }> = {
      track1: { type: 'BasicTrack', trackId: 'track1' },
      track2: { type: 'BasicTrack', trackId: 'track2' },
    }

    const Session = types
      .model({
        name: 'testSession',
        view: types.maybe(LinearGenomeModel),
        configuration: types.map(types.string),
        assemblyManager: types.optional(AssemblyManager, {
          assemblies: {
            volvox: {
              regions: volvoxDisplayedRegions,
            },
          },
        }),
      })
      .volatile(() => ({
        rpcManager: {
          call: async () => {},
        },
      }))
      .views(() => ({
        getTrackById(id: string) {
          return trackConfigs[id]
        },
      }))
      .actions(self => ({
        setView(view: LGV) {
          self.view = view
          return view
        },
        notifyError(msg: string, _err: Error) {
          console.warn(msg)
        },
      }))

    return { Session, LinearGenomeModel, pluginManager: stubManager }
  }

  test('init with string trackIds works (backwards compatibility)', async () => {
    const { Session, LinearGenomeModel, pluginManager } = initializeWithTracks()
    const session = Session.create({ configuration: {} }, { pluginManager })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        init: {
          assembly: 'volvox',
          loc: 'ctgA:1-1000',
          tracks: ['track1', 'track2'],
        },
      }),
    )
    model.setWidth(800)

    await waitFor(() => {
      expect(model.tracks.length).toBe(2)
    })
    expect(model.tracks[0]!.configuration.trackId).toBe('track1')
    expect(model.tracks[1]!.configuration.trackId).toBe('track2')
  })

  test('init with object trackIds allows specifying display type via displaySnapshot', async () => {
    const { Session, LinearGenomeModel, pluginManager } = initializeWithTracks()
    const session = Session.create({ configuration: {} }, { pluginManager })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        init: {
          assembly: 'volvox',
          loc: 'ctgA:1-1000',
          tracks: [
            {
              trackId: 'track1',
              displaySnapshot: { type: 'LinearBareDisplay' },
            },
          ],
        },
      }),
    )
    model.setWidth(800)

    await waitFor(() => {
      expect(model.tracks.length).toBe(1)
    })
    expect(model.tracks[0]!.configuration.trackId).toBe('track1')
    expect(model.tracks[0]!.displays[0]!.type).toBe('LinearBareDisplay')
  })

  test('init with object trackIds allows specifying displaySnapshot', async () => {
    const { Session, LinearGenomeModel, pluginManager } = initializeWithTracks()
    const session = Session.create({ configuration: {} }, { pluginManager })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        init: {
          assembly: 'volvox',
          loc: 'ctgA:1-1000',
          tracks: [
            {
              trackId: 'track1',
              displaySnapshot: { height: 250 },
            },
          ],
        },
      }),
    )
    model.setWidth(800)

    await waitFor(() => {
      expect(model.tracks.length).toBe(1)
    })
    expect(model.tracks[0]!.displays[0]!.height).toBe(250)
  })

  test('init with mixed string and object trackIds', async () => {
    const { Session, LinearGenomeModel, pluginManager } = initializeWithTracks()
    const session = Session.create({ configuration: {} }, { pluginManager })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        init: {
          assembly: 'volvox',
          loc: 'ctgA:1-1000',
          tracks: [
            'track1',
            {
              trackId: 'track2',
              displaySnapshot: { height: 300 },
            },
          ],
        },
      }),
    )
    model.setWidth(800)

    await waitFor(() => {
      expect(model.tracks.length).toBe(2)
    })
    // First track - simple string, uses default display
    expect(model.tracks[0]!.configuration.trackId).toBe('track1')
    expect(model.tracks[0]!.displays[0]!.type).toBe('LinearBareDisplay')

    // Second track - object with height in displaySnapshot
    expect(model.tracks[1]!.configuration.trackId).toBe('track2')
    expect(model.tracks[1]!.displays[0]!.type).toBe('LinearBareDisplay')
    expect(model.tracks[1]!.displays[0]!.height).toBe(300)
  })
})

describe('highlights', () => {
  function setupHighlightModel() {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({
      configuration: {},
    })
    const model = session.setView(
      LinearGenomeModel.create({
        id: 'highlight-test',
        type: 'LinearGenomeView',
        tracks: [],
      }),
    )
    model.setWidth(800)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])
    model.setNewView(1, 0)
    return model
  }

  test('add and remove highlights', () => {
    const model = setupHighlightModel()
    const h = { refName: 'ctgA', start: 100, end: 200, assemblyName: 'volvox' }
    model.addToHighlights(h)
    expect(model.highlight.length).toBe(1)
    expect(model.highlight[0]!.start).toBe(100)
    model.removeHighlight(model.highlight[0]!)
    expect(model.highlight.length).toBe(0)
  })

  test('setHighlight replaces the array', () => {
    const model = setupHighlightModel()
    model.setHighlight([
      { refName: 'ctgA', start: 0, end: 50, assemblyName: 'volvox' },
      { refName: 'ctgA', start: 100, end: 200, assemblyName: 'volvox' },
    ])
    expect(model.highlight.length).toBe(2)
    model.setHighlight([])
    expect(model.highlight.length).toBe(0)
  })

  test('label toggle defaults to true and can be flipped', () => {
    const model = setupHighlightModel()
    expect(model.labelsVisible).toBe(true)
    model.setLabelsVisible(false)
    expect(model.labelsVisible).toBe(false)
  })

  test('updateHighlight replaces label and color in place', () => {
    const model = setupHighlightModel()
    const h = { refName: 'ctgA', start: 100, end: 200, assemblyName: 'volvox' }
    model.addToHighlights(h)
    const ref = model.highlight[0]!
    model.updateHighlight(ref, { label: 'test', color: '#ff0000' })
    expect(model.highlight.length).toBe(1)
    expect(model.highlight[0]!.label).toBe('test')
    expect(model.highlight[0]!.color).toBe('#ff0000')
    expect(model.highlight[0]!.start).toBe(100)
  })

  test('getHighlightCoords maps to pixel position', () => {
    const model = setupHighlightModel()
    // 1 bp/px and offset 0, so start=100 -> left=100, width=100
    const coords = model.getHighlightCoords({
      refName: 'ctgA',
      start: 100,
      end: 200,
      assemblyName: 'volvox',
    })
    expect(coords).toBeDefined()
    expect(coords!.left).toBe(100)
    expect(coords!.width).toBe(100)
  })

  test('getHighlightCoords falls back when assemblyName is missing', () => {
    const model = setupHighlightModel()
    // no assemblyName -- should still resolve via refName against displayed
    // regions in a single-assembly view
    const coords = model.getHighlightCoords({
      refName: 'ctgA',
      start: 100,
      end: 200,
    })
    expect(coords).toBeDefined()
    expect(coords!.left).toBe(100)
  })

  test('getHighlightCoords floors width at 3px for sub-pixel highlights', () => {
    const model = setupHighlightModel()
    // max zoom out for this view is ~13.9 bp/px; a 1bp highlight is well
    // below 1px and should be floored at 3
    model.setNewView(13, 0)
    const coords = model.getHighlightCoords({
      refName: 'ctgA',
      start: 100,
      end: 101,
      assemblyName: 'volvox',
    })
    expect(coords).toBeDefined()
    expect(coords!.width).toBe(3)
  })

  test('getHighlightCoords returns undefined for an off-region highlight', () => {
    const model = setupHighlightModel()
    expect(
      model.getHighlightCoords({
        refName: 'noExist',
        start: 0,
        end: 100,
        assemblyName: 'volvox',
      }),
    ).toBeUndefined()
  })
})

describe('onTrackDragOver reorders tracks', () => {
  function setup() {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        id: 'dragOver',
        type: 'LinearGenomeView',
        tracks: [
          { name: 'a', type: 'BasicTrack' },
          { name: 'b', type: 'BasicTrack' },
          { name: 'c', type: 'BasicTrack' },
        ],
      }),
    )
    const [a, b, c] = model.tracks.map(t => t.id)
    return { model, a: a!, b: b!, c: c! }
  }

  test('drag down places the track after the target', () => {
    const { model, a, b, c } = setup()
    model.setDraggingTrackId(a)
    model.onTrackDragOver(c, 100)
    expect(model.tracks.map(t => t.id)).toEqual([b, c, a])
  })

  test('drag up places the track before the target', () => {
    const { model, a, b, c } = setup()
    model.setDraggingTrackId(c)
    model.onTrackDragOver(b, 100)
    expect(model.tracks.map(t => t.id)).toEqual([a, c, b])
  })

  test('does not reorder until cursor moves past the jitter threshold', () => {
    const { model, a, b, c } = setup()
    model.setDraggingTrackId(a)
    model.onTrackDragOver(b, 100)
    expect(model.tracks.map(t => t.id)).toEqual([b, a, c])

    // small move back up over b is below the threshold, so no swap
    model.onTrackDragOver(b, 90)
    expect(model.tracks.map(t => t.id)).toEqual([b, a, c])
  })

  test('ignores dragover when no track is being dragged', () => {
    const { model, a, b, c } = setup()
    model.onTrackDragOver(b, 100)
    expect(model.tracks.map(t => t.id)).toEqual([a, b, c])
  })
})

describe('move actions respect pinned/unpinned sections', () => {
  function setup() {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        id: 'moveSections',
        type: 'LinearGenomeView',
        tracks: [
          { name: 'a', type: 'BasicTrack' },
          { name: 'b', type: 'BasicTrack' },
          { name: 'c', type: 'BasicTrack' },
        ],
      }),
    )
    const [a, b, c] = model.tracks.map(t => t.id)
    return { model, a: a!, b: b!, c: c! }
  }

  // pinning the *middle* track leaves the array as [a(unpinned), b(pinned),
  // c(unpinned)] -- the two unpinned tracks straddle a pinned track, so
  // array-adjacency swaps would cross the section boundary
  test('move up crosses the pinned track without a silent no-op', () => {
    const { model, a, c } = setup()
    model.tracks[1]!.setPinned(true)
    // c is below a in the unpinned section; moving it up must land it above a,
    // not silently swap with the pinned track b sitting between them
    model.moveTrackUp(c)
    expect(model.unpinnedTracks.map(t => t.id)).toEqual([c, a])
  })

  test('move down crosses the pinned track without a silent no-op', () => {
    const { model, a, c } = setup()
    model.tracks[1]!.setPinned(true)
    model.moveTrackDown(a)
    expect(model.unpinnedTracks.map(t => t.id)).toEqual([c, a])
  })

  test('move to top/bottom stay within the unpinned section', () => {
    const { model, a, b, c } = setup()
    model.tracks[1]!.setPinned(true)
    model.moveTrackToTop(c)
    expect(model.unpinnedTracks.map(t => t.id)).toEqual([c, a])
    model.moveTrackToBottom(c)
    expect(model.unpinnedTracks.map(t => t.id)).toEqual([a, c])
    // pinned track b never leaves the pinned section
    expect(model.pinnedTracks.map(t => t.id)).toEqual([b])
  })
})

describe('getTrackOrderSubMenu gates items by track count and view level', () => {
  function makeView(trackCount: number, nested = false) {
    const { Session, LinearGenomeModel } = initialize()
    const view = LinearGenomeModel.create({
      id: nested ? 'nested' : 'topLevel',
      type: 'LinearGenomeView',
      tracks: Array.from({ length: trackCount }, (_, i) => ({
        name: `t${i}`,
        type: 'BasicTrack',
      })),
    })
    const session = Session.create({ configuration: {} })
    return nested ? session.setNestedView(view) : session.setView(view)
  }

  function labels(view: LGV) {
    return getTrackOrderSubMenu({ view, track: view.tracks[0]! }).map(m =>
      'label' in m ? m.label : undefined,
    )
  }

  test('single top-level track offers pin only, no moves', () => {
    expect(labels(makeView(1))).toEqual(['Pin track'])
  })

  test('two tracks add up/down but not the to-top/to-bottom jumps', () => {
    expect(labels(makeView(2))).toEqual([
      'Pin track',
      'Move track up',
      'Move track down',
    ])
  })

  test('three+ tracks add the to-top and to-bottom jumps', () => {
    expect(labels(makeView(3))).toEqual([
      'Pin track',
      'Move track to top',
      'Move track up',
      'Move track down',
      'Move track to bottom',
    ])
  })

  test('pin item reflects the pinned state', () => {
    const view = makeView(1)
    view.tracks[0]!.setPinned(true)
    expect(labels(view)).toEqual(['Unpin track'])
  })

  test('single nested (non-top-level) track yields an empty submenu', () => {
    // regression: this used to render an empty "Track order" parent entry
    expect(labels(makeView(1, true))).toEqual([])
  })
})

describe('declarative init: highlight, nav, unknown keys', () => {
  function makeModel(init: InitState) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        init,
      }),
    )
    model.setWidth(800)
    return model
  }

  test('init.highlight loc-string is parsed onto the highlight list', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      highlight: ['ctgA:100-200'],
    })
    await waitFor(() => {
      expect(model.highlight.length).toBe(1)
    })
    const h = model.highlight[0]!
    expect(h.refName).toBe('ctgA')
    expect(h.assemblyName).toBe('volvox')
    expect(h.start).toBeLessThan(h.end)
  })

  test('init.highlight JSON form carries color/label and assembly fallback', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      highlight: [
        '{"refName":"ctgA","start":100,"end":200,"color":"#123456","label":"my region"}',
      ],
    })
    await waitFor(() => {
      expect(model.highlight.length).toBe(1)
    })
    const h = model.highlight[0]!
    expect(h.start).toBe(100)
    expect(h.end).toBe(200)
    expect(h.color).toBe('#123456')
    expect(h.label).toBe('my region')
    // assemblyName omitted in the JSON, so it falls back to init.assembly
    expect(h.assemblyName).toBe('volvox')
  })

  test('init.highlight JSON form keeps an explicit assemblyName', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      highlight: [
        '{"refName":"ctgA","start":1,"end":2,"assemblyName":"volvox2"}',
      ],
    })
    await waitFor(() => {
      expect(model.highlight.length).toBe(1)
    })
    expect(model.highlight[0]!.assemblyName).toBe('volvox2')
  })

  test('init.highlight accepts a HighlightType object directly', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      highlight: [
        { refName: 'ctgA', start: 100, end: 200, label: 'a label with spaces' },
      ],
    })
    await waitFor(() => {
      expect(model.highlight.length).toBe(1)
    })
    const h = model.highlight[0]!
    expect(h.start).toBe(100)
    expect(h.end).toBe(200)
    expect(h.label).toBe('a label with spaces')
    // assemblyName omitted on the object, so it falls back to init.assembly
    expect(h.assemblyName).toBe('volvox')
  })

  test('init.highlight without loc applies the highlight', async () => {
    const model = makeModel({
      assembly: 'volvox',
      highlight: ['ctgA:100-200'],
    })
    await waitFor(() => {
      expect(model.highlight.length).toBe(1)
    })
    // no loc => showAllRegionsInAssembly ran (nothing was displayed yet)
    expect(model.hasDisplayedRegions).toBe(true)
    expect(model.highlight[0]!.refName).toBe('ctgA')
  })

  // regression: with init.tracklist the autorun reads raw volatileWidth and
  // awaits a width settle, so a width change while init is mid-apply re-triggers
  // it before `init` is cleared. addToHighlights pushes, so a re-entrant pass
  // duplicated the highlight (the double highlights seen under React StrictMode's
  // double mount, which churns volatileWidth). Without tracklist this doesn't
  // reproduce: the autorun's only width dependency is the `initialized`
  // computed, which doesn't re-notify while its boolean value stays true.
  test('init.highlight is applied once when width churns mid-init', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      tracklist: true,
      highlight: ['ctgA:100-200'],
    })
    // makeModel already setWidth(800), kicking off the async init autorun which
    // is now suspended on the tracklist width-settle await. Churn volatileWidth
    // in the same tick to re-trigger the autorun while init is still set.
    model.setWidth(801)
    model.setWidth(802)
    model.setWidth(803)
    await waitFor(() => {
      expect(model.init).toBeUndefined()
    })
    expect(model.highlight.length).toBe(1)
  })

  test('init.nav false hides the header', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      nav: false,
    })
    await waitFor(() => {
      expect(model.hideHeader).toBe(true)
    })
  })

  test('showCenterLine restores from an input snapshot but is stripped from getSnapshot', async () => {
    // showCenterLine is a direct view prop, not an init key — MST restores it
    // natively from the view snapshot (LaunchView forwards it as a sibling of
    // init, never inside it). It's purely a localStorage-backed preference
    // though, so postProcessSnapshot strips it back out of session saves.
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        showCenterLine: true,
        init: { assembly: 'volvox', loc: 'ctgA:1-1000' },
      }),
    )
    model.setWidth(800)
    await waitFor(() => {
      expect(model.showCenterLine).toBe(true)
    })
    expect(getSnapshot(model)).not.toHaveProperty('showCenterLine')
  })

  test('unknown init key warns instead of silently dropping', async () => {
    // deliberately typo'd key (tracksList vs tracks) to exercise the diagnostic
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      tracksList: [],
    } as InitState)
    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('tracksList'),
      )
    })
    // init is still consumed/cleared despite the unknown key
    await waitFor(() => {
      expect(model.init).toBeUndefined()
    })
  })
})
