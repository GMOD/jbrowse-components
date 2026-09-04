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
import {
  getSession,
  statusFraction,
  statusMessageText,
  statusSource,
} from '@jbrowse/core/util'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import { getTrackOrderSubMenu } from './components/trackLabelMenuItems.ts'
import hg38Regions from './hg38DisplayedRegions.json' with { type: 'json' }
import { stateModelFactory } from './index.ts'
import { setDisplayedRegionsKeepingCenter } from './util.ts'
import volvoxDisplayedRegions from './volvoxDisplayedRegions.json' with { type: 'json' }

import type { LinearGenomeViewModel } from './index.ts'
import type { InitState } from './types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { RpcStatus } from '@jbrowse/core/util'

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
      // never rendered here; this harness exercises the model
      ReactComponent: () => null,
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
      // mirrors the real model's load-status fields, which the view's
      // loadingMessage/loadingProgress/loadingSource read. A field missed here
      // does not fail — the view's getter simply reads undefined off a stub that
      // never had it — so keep this in step with `assembly.ts`
      statusMessage: undefined as string | undefined,
      statusProgress: undefined as number | undefined,
      statusSource: undefined as string | undefined,
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
    .views(self => ({
      // and its total counterpart, which the view's own refName resolution
      // goes through: an unknown name comes back unchanged rather than
      // undefined
      getCanonicalRefName2(refName: string) {
        return self.getCanonicalRefName(refName) ?? refName
      },
      // the real one reads a memo; a scan is the same answer at stub scale
      getRegionForRefName(refName: string) {
        return self.regions.find(r => r.refName === refName)
      },
    }))
    .actions(self => ({
      async load() {},
      setStatus(status?: RpcStatus) {
        self.statusMessage = statusMessageText(status)
        self.statusProgress = statusFraction(status)
        self.statusSource = statusSource(status)
      },
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

      loadingAssembly(names: string[]) {
        return names
          .map(name => self.assemblies.get(name))
          .find(asm => !asm?.initialized)
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
      // mirrors the real drawer: a minimized drawer still reports a
      // visibleWidget while taking no width from the view, and showWidget
      // un-minimizes it. init.tracklist keys its width-settle wait off exactly
      // that pair.
      minimized: types.optional(types.boolean, false),
      // mirrors BaseSession's session-wide highlight band toggle, which
      // view.revealHighlights writes through
      highlightsVisible: types.optional(types.boolean, true),
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
      // most recently added widget, like the real session's
      get visibleWidget() {
        return [...self.widgets.values()].at(-1)
      },
      getTrackById(_id: string) {
        return undefined
      },
      // every promotable-slot read walks the cascade through this; nothing is
      // promoted in these tests, so every display resolves to its promotedBase
      getDisplayTypeDefault() {
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
      showWidget() {
        self.minimized = false
      },
      hideWidget() {},
      minimizeWidgetDrawer() {
        self.minimized = true
      },
      setHighlightsVisible(arg: boolean) {
        self.highlightsVisible = arg
      },
      revealHighlights() {
        self.highlightsVisible = true
      },
    }))

  return { Session, LinearGenomeModel, Assembly }
}

// Multi-region zoom: regions are laid out back to back in a single bp space, so
// the cursor's bp is (offsetPx + cursor_x) * bpPerPx no matter which region it
// lands in and the anchor must survive a run of zoom steps without drifting.
// Guards against reintroducing a per-region round-trip that loses a bp per call.
// Not flipped-specific — flipping just makes drift visible.
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
    // `.offset` — the raw float bp offset into the region — not `.coord`, which
    // is `regionCoord`'s floor+1 and so quantized to whole bp. At bpPerPx=1 one
    // bp IS one pixel, so a bound below 1px cannot distinguish a viewport that
    // moved from one that merely crossed a floor boundary, and which of those
    // you get depends on where the arithmetic happens to land.
    const samples: { bpPerPx: number; offset: number; index: number }[] = []

    // mimic wheel handler: zoomAccum capped at MAX_ZOOM_RATE_PER_MS * 16.67 ≈ 0.2
    const d = sign * 0.05
    const ratio = d > 0 ? 1 + d : 1 / (1 - d)
    for (let frame = 0; frame < 30; frame++) {
      model.zoomTo(model.bpPerPx * ratio, cursorPx)
      const at = model.pxToBp(cursorPx)
      samples.push({
        bpPerPx: model.bpPerPx,
        offset: at.offset,
        index: at.index,
      })
    }

    // the anchor must not wander into a neighbouring region either, which
    // comparing within-region offsets would not otherwise notice
    expect(samples.map(s => s.index)).toEqual(samples.map(() => initial.index))

    const maxDriftPx = Math.max(
      ...samples.map(s => Math.abs(s.offset - initial.offset) / s.bpPerPx),
    )
    // Pre-fix: monotonic drift up to ~5 px at bpPerPx=1, frame-to-frame
    // oscillation up to ~1.5 px at higher bpPerPx. Now the zoom anchor is
    // computed in the units the viewport is stored in — bp — so no conversion
    // or rounding sits in the loop at all and the residual is float noise.
    expect(maxDriftPx).toBeLessThan(1e-6)
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

  // the scalebar alone. It used to carry a spare 3 that turned out to be the
  // first track's leading gap and border, which now sit on the track where they
  // are laid out.
  expect(model.scalebarHeight).toEqual(17)
  // header height 20 + area where polygons get drawn has height of 48
  expect(model.headerHeight).toEqual(68)
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

// the multi-location branch used to spread the parsed location straight into
// displayedRegions, which kept the user's alias refName, dragged the whole
// nested parentRegion object into the persisted snapshot, and let `grow` push
// coordinates past the end of the chromosome
test('navToLocations with multiple locations writes clean, in-bounds regions', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'navToLocationsMulti',
      type: 'LinearGenomeView',
    }),
  )
  model.setWidth(800)

  // ctgB is 6079bp, so grow=1 on 6000-6070 would reach 6140 unclamped
  await model.navToLocations(
    [
      { refName: 'contiga', start: 100, end: 200 },
      { refName: 'ctgb', start: 6000, end: 6070 },
    ],
    'volvox',
    1,
  )

  expect(model.displayedRegions).toEqual([
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 300,
      reversed: undefined,
    },
    {
      assemblyName: 'volvox',
      refName: 'ctgB',
      start: 5930,
      end: 6079,
      reversed: undefined,
    },
  ])

  // Named regions fit the width exactly, edge to edge, the same as the
  // single-location path. showAllRegions would land on maxBpPerPx instead,
  // which is 1/SHOW_ALL_REGIONS_FILL larger and leaves the row centered with a
  // 5% margin either side — invisible on its own and an 11% scale difference
  // from a one-region row beside it in a stacked synteny view.
  expect(model.bpPerPx).toBeCloseTo(model.totalBp / 800)
  expect(model.bpPerPx).toBeLessThan(model.maxBpPerPx)
  expect(model.offsetPx).toBe(0)
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

// removing/replacing regions shrinks maxOffset; a view already scrolled past
// the new end must be pulled back, otherwise it sits on blank space
test('setDisplayedRegions re-clamps a now-out-of-range offsetPx', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'testSetDisplayedRegionsClamp',
      type: 'LinearGenomeView',
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 10000 },
  ])
  model.setNewView(10, 1900)
  expect(model.offsetPx).toBe(1900)

  // drop ctgB: total content is now 1000px, so maxOffset is 990
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
  ])
  expect(model.offsetPx).toBe(990)
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

// `grow` must be clamped to the region that actually contains the location, not
// to the first region sharing its refName: clamping against the first one
// dragged an endpoint outside every region and made the containment search fail,
// so navTo(loc) worked while navTo(loc, grow) threw for the same loc
test('navTo with grow on a duplicated refName', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'testNavToGrowDuplicateRefName',
      type: 'LinearGenomeView',
    }),
  )
  model.setWidth(800)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 5000, end: 20000 },
    { assemblyName: 'volvox', refName: 'ctgA', start: 30000, end: 40000 },
    { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 3000 },
  ])

  // 1000bp of the second ctgA region, no padding
  model.navTo({ refName: 'ctgA', start: 32000, end: 33000 })
  expect(model.bpPerPx).toBeCloseTo(1.25)

  // same target, padded 20% either side: 1400bp across the same 800px
  model.navTo({ refName: 'ctgA', start: 32000, end: 33000 }, 0.2)
  expect(model.bpPerPx).toBeCloseTo(1.75)
})

describe('animated zoom hands off to direct interaction', () => {
  function setup(id: string) {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({ id, type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100000 },
    ])
    model.zoomTo(10)
    return model
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  // guards the `animating` flag from the opposite failure: if it were never set,
  // the animation's own first zoomTo would cancel the animation and zoom() would
  // do nothing at all
  it('an uninterrupted animated zoom reaches its target', () => {
    const model = setup('testZoomAnimReaches')
    model.zoom(1)
    jest.advanceTimersByTime(3000)
    expect(model.bpPerPx).toBeCloseTo(1)
  })

  // the spring keeps driving zoomTo for up to a second, so a wheel zoom, a
  // rubberband "zoom to region" or a nav landing in that window used to be
  // overwritten on the next frame
  it('a direct zoomTo mid-animation wins', () => {
    const model = setup('testZoomAnimHandoff')
    model.zoom(1)
    model.zoomTo(5)
    jest.advanceTimersByTime(3000)
    expect(model.bpPerPx).toBe(5)
  })
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

// `bufferedVisibleRegions` is the single join between the view and the fetch
// path: `MultiRegionDisplayMixin.FetchVisibleRegions` hands exactly these to
// every per-region display's `fetchNeeded`, and they are what `loadedRegions`
// records. Every field is load-bearing for some display, so the whole shape is
// pinned here rather than left to whichever display happens to notice a loss.
// It had no direct coverage at all until `reversed` went missing in a rewrite
// (see below) — every display-level test constructs its own regions and so
// cannot see this getter change under it.
describe('bufferedVisibleRegions — the fetch-path contract', () => {
  function viewOn(
    regions: {
      refName: string
      start: number
      end: number
      reversed?: boolean
    }[],
    id: string,
  ) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        id,
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo', type: 'BasicTrack' }],
      }),
    )
    model.setWidth(800)
    model.setDisplayedRegions(
      regions.map(r => ({ assemblyName: 'volvox', ...r })),
    )
    return model
  }

  it('clamps to the displayedRegion bounds rather than over-reaching it', () => {
    // whole region on screen: the half-screen buffer has nowhere to go, so the
    // fetch region is the displayed region exactly. An adapter queried past a
    // contig end is the failure this prevents.
    const model = viewOn([{ refName: 'ctgA', start: 1000, end: 2000 }], 'buf-1')
    expect(model.bufferedVisibleRegions.map(b => b.region)).toEqual([
      { refName: 'ctgA', start: 1000, end: 2000, assemblyName: 'volvox' },
    ])
  })

  it('widens by half a screen on each side when there is room', () => {
    const model = viewOn([{ refName: 'ctgA', start: 0, end: 50000 }], 'buf-2')
    model.setNewView(1, 10000) // bpPerPx 1, offsetPx 10000
    const bufferBp = Math.ceil(model.width * model.bpPerPx * 0.5)
    expect(bufferBp).toBe(400)
    const [visible] = model.visibleRegions
    const [buffered] = model.bufferedVisibleRegions
    expect(buffered!.region.start).toBe(Math.floor(visible!.start) - bufferBp)
    expect(buffered!.region.end).toBe(Math.ceil(visible!.end) + bufferBp)
  })

  it('rounds to integer bounds at fractional bpPerPx', () => {
    const model = viewOn([{ refName: 'ctgA', start: 0, end: 50000 }], 'buf-3')
    model.setNewView(1.7, 3333)
    for (const { region } of model.bufferedVisibleRegions) {
      expect(Number.isInteger(region.start)).toBe(true)
      expect(Number.isInteger(region.end)).toBe(true)
    }
  })

  it('keeps displayedRegionIndex as the join key across regions', () => {
    const model = viewOn(
      [
        { refName: 'ctgA', start: 0, end: 1000 },
        { refName: 'ctgB', start: 0, end: 1000 },
      ],
      'buf-4',
    )
    model.showAllRegions()
    expect(
      model.bufferedVisibleRegions.map(b => b.displayedRegionIndex),
    ).toEqual(model.visibleRegions.map(b => b.displayedRegionIndex))
  })

  // Orientation has to ride along with the fetch region, not just with the
  // render blocks: canvas stamps it onto its rpcDataMap entry
  // (`reversedRegions`), which flips label-overhang packing in layout and in
  // the Flatbush hit index. It went missing when this getter was rewritten from
  // a `{...block}` spread into an explicit object literal, and nothing caught
  // it — every canvas test hands `setRpcData` a region by hand.
  it('carries reversed, which canvas records as the fetch orientation', () => {
    const fwd = viewOn([{ refName: 'ctgA', start: 1000, end: 2000 }], 'buf-5')
    expect(fwd.bufferedVisibleRegions.every(b => !b.region.reversed)).toBe(true)

    const rev = viewOn(
      [{ refName: 'ctgA', start: 1000, end: 2000, reversed: true }],
      'buf-6',
    )
    expect(rev.bufferedVisibleRegions.length).toBeGreaterThan(0)
    expect(rev.bufferedVisibleRegions.every(b => b.region.reversed)).toBe(true)
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
      assembly: 'volvox',
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
      assembly: 'volvox',
      loc: 'ctgA:1-100',
    }),
  )
  model.setWidth(800)

  // navToLocString awaits the assembly asynchronously, so right after setWidth
  // the assembly is initialized but displayedRegions is still empty. The
  // container must not mount in this window (its hover pxToBp throws on empty
  // regions) — showLoading has to stay true, not fall through to the view.
  expect(model.initialized).toBe(true)
  expect(model.hasDisplayedRegions).toBe(false)
  expect(model.awaitingInitNavigation).toBe(true)
  expect(model.showLoading).toBe(true)
  expect(model.showImportForm).toBe(false)

  await waitFor(() => {
    expect(model.hasDisplayedRegions).toBe(true)
  })
  expect(model.awaitingInitNavigation).toBe(false)
  expect(model.showLoading).toBe(false)
})

// `status` is what a host drawing its own chrome branches on. The case worth
// pinning is the disagreement in the first block: `ready` is true with nothing
// on screen, so a host gating on it mounts track components over a view with no
// regions and draws an empty box with nothing saying why.
test('status names the state ready reports as ready', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({ id: 'testStatus', type: 'LinearGenomeView' }),
  )
  model.setWidth(800)

  expect(model.hasSomethingToShow).toBe(false)
  expect(model.ready).toBe(true)
  expect(model.status).toEqual({ type: 'noRegions' })

  model.setError('assembly volvox not found')
  expect(model.status).toEqual({
    type: 'error',
    error: 'assembly volvox not found',
  })
  model.setError(undefined)

  model.setDisplayedRegions(volvoxDisplayedRegions)
  await waitFor(() => {
    expect(model.status).toEqual({ type: 'ready' })
  })
})

test('status carries the loading message the spinner would draw', async () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'testStatusLoading',
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-100',
    }),
  )
  model.setWidth(800)

  expect(model.showLoading).toBe(true)
  expect(model.status).toEqual({
    type: 'loading',
    message: model.loadingMessage,
    progress: model.loadingProgress,
  })

  await waitFor(() => {
    expect(model.status).toEqual({ type: 'ready' })
  })
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
      // mirrors the real model, which loadingAssembly filters on
      initialized: true,
    }))
    .views(() => ({
      // hg38 fixture refNames are unprefixed ('1'), so 'chr1' is an alias of
      // '1'; undefined for anything the assembly lacks, as the real model does
      getCanonicalRefName(refName: string) {
        const name = refName.replace('chr', '')
        return hg38Regions.some(r => r.refName === name) ? name : undefined
      },
    }))
    .views(self => ({
      getCanonicalRefName2(refName: string) {
        return self.getCanonicalRefName(refName) ?? refName
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

      loadingAssembly(names: string[]) {
        return names
          .map(name => self.assemblies.get(name))
          .find(asm => !asm?.initialized)
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
      assembly: 'volvox',
      loc: 'ctgA:1000-2000',
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

test('loadingMessage reports what the assembly load is downloading', () => {
  const { Session, LinearGenomeModel } = initialize()
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1000-2000',
    }),
  )
  expect(model.showLoading).toBe(true)
  // nothing reported yet, so the generic label
  expect(model.loadingMessage).toBe('Loading')
  expect(model.loadingProgress).toBeUndefined()

  // assertions stay in this one synchronous block: the real load is in flight
  // and its `finally` clears the status, so anything after an await would race
  const asm = model.loadingAssembly!
  asm.setStatus({
    message: 'Downloading chromosome aliases',
    current: 1,
    total: 4,
  })
  expect(model.loadingMessage).toBe('Downloading chromosome aliases')
  expect(model.loadingProgress).toBe(0.25)

  // an indeterminate phase keeps the label but drops the bar
  asm.setStatus('Downloading chromosome sizes')
  expect(model.loadingMessage).toBe('Downloading chromosome sizes')
  expect(model.loadingProgress).toBeUndefined()

  asm.setStatus(undefined)
  expect(model.loadingMessage).toBe('Loading')

  // and the address the stalled-load notice shows, which rides the same status
  // rather than a channel of its own
  asm.setStatus({
    message: 'Downloading chromosome aliases',
    source: 'https://hgdownload.soe.ucsc.edu/hg38.chromAlias.txt',
  })
  expect(model.loadingMessage).toBe('Downloading chromosome aliases')
  expect(model.loadingProgress).toBeUndefined()
  expect(model.loadingSource).toBe(
    'https://hgdownload.soe.ucsc.edu/hg38.chromAlias.txt',
  )

  asm.setStatus('Downloading cytobands')
  expect(model.loadingSource).toBeUndefined()
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

// setNewView's bp-space twin, and the whole reason to prefer it: a viewport
// captured and put back is exact across a resize, where the pixel pair is not.
test('setWindow restores the same genomic window at a different width', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 },
      ],
    }),
  )

  model.setWidth(800)
  model.setWindow(9000, 12_000)
  expect(model.windowWidthBp).toBe(9000)
  expect(model.windowStartBp).toBe(12_000)

  // the same pair, re-applied after the window narrowed: still the same bases on
  // screen, now at half the bp per pixel. setNewView's pixels would have been
  // reinterpreted against 400 and shown half as much.
  model.setWidth(400)
  model.setWindow(9000, 12_000)
  expect(model.windowWidthBp).toBe(9000)
  expect(model.windowStartBp).toBe(12_000)
  expect(model.bpPerPx).toBe(9000 / 400)
})

// The two halves of the fit rule, tested where it lives rather than through a
// consumer. They are not equally load-bearing, and a mutation check says which:
// scaling the whole fit also fails `navToLocations with multiple locations`
// above, which reaches fitAllRegions incidentally, so the exact fit had cover
// already. Dropping the floor — `max(minBpPerPx * width, totalBp)` down to bare
// `totalBp` — failed nothing in this package. That is the hole.
test('fitAllRegions fills the width edge to edge, unlike showAllRegions', () => {
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
  model.fitAllRegions()

  // the same 3000bp the showAllRegions test above frames at 3.704 with a 10%
  // margin: 3000 / 900 exactly, and nothing left to scroll
  expect(model.bpPerPx).toBeCloseTo(3000 / 900, 5)
  expect(model.offsetPx).toBe(0)
})

test('fitAllRegions stops at the zoom-in floor and centers what cannot fill', () => {
  const { Session, LinearGenomeModel } = initialize()
  const session = Session.create({ configuration: {} })
  const model = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10 },
      ],
    }),
  )

  model.setWidth(900)
  model.fitAllRegions()

  // 10bp across 900px wants 1/90 bp/px, past the 1/50 floor. So the content is
  // 500px in a 900px viewport and the centering is what frames it.
  expect(model.bpPerPx).toBe(model.minBpPerPx)
  expect(model.offsetPx).toBe((10 / model.minBpPerPx - 900) / 2)
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
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
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
      .views(self => ({
        getCanonicalRefName2(refName: string) {
          return self.getCanonicalRefName(refName) ?? refName
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
        assembly: 'volvox',
        loc: 'ctgA:1-1000',
        tracks: ['track1', 'track2'],
      }),
    )
    model.setWidth(800)

    await waitFor(() => {
      expect(model.tracks.length).toBe(2)
    })
    expect(model.tracks[0]!.configuration.trackId).toBe('track1')
    expect(model.tracks[1]!.configuration.trackId).toBe('track2')
  })

  test('a measured label band moves the track offsets and the view height', async () => {
    const { Session, LinearGenomeModel, pluginManager } = initializeWithTracks()
    const session = Session.create({ configuration: {} }, { pluginManager })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-1000',
        tracks: ['track1', 'track2'],
      }),
    )
    model.setWidth(800)
    await waitFor(() => {
      expect(model.tracks.length).toBe(2)
    })
    const top1 = model.getTrackYOffset('track1')!
    const top2 = model.getTrackYOffset('track2')!
    const height = model.height
    const perTrack =
      model.trackHeight(model.tracks[0]) + model.trackChromeHeight
    expect(top2 - top1).toBe(perTrack)

    model.setTrackLabelBand('track1', 31.14)
    expect(model.getTrackYOffset('track1')).toBeCloseTo(top1 + 31.14)
    expect(model.getTrackYOffset('track2')).toBeCloseTo(top2 + 31.14)
    expect(model.height).toBeCloseTo(height + 31.14)

    model.setTrackLabelBand('track2', 31.14)
    expect(model.getTrackYOffset('track2')).toBeCloseTo(top2 + 2 * 31.14)
    expect(model.height).toBeCloseTo(height + 2 * 31.14)

    model.setTrackLabelBand('track1', 0)
    model.setTrackLabelBand('track2', 0)
    expect(model.getTrackYOffset('track2')).toBe(top2)
    expect(model.height).toBe(height)
  })

  test('init with object trackIds allows specifying display type via displaySnapshot', async () => {
    const { Session, LinearGenomeModel, pluginManager } = initializeWithTracks()
    const session = Session.create({ configuration: {} }, { pluginManager })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-1000',
        tracks: [
          {
            trackId: 'track1',
            displaySnapshot: { type: 'LinearBareDisplay' },
          },
        ],
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
        assembly: 'volvox',
        loc: 'ctgA:1-1000',
        tracks: [
          {
            trackId: 'track1',
            displaySnapshot: { height: 250 },
          },
        ],
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
        assembly: 'volvox',
        loc: 'ctgA:1-1000',
        tracks: [
          'track1',
          {
            trackId: 'track2',
            displaySnapshot: { height: 300 },
          },
        ],
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

  test('a new highlight reveals the session-wide bands', () => {
    const model = setupHighlightModel()
    const session = getSession(model)
    session.setHighlightsVisible(false)

    model.addToHighlights({
      refName: 'ctgA',
      start: 100,
      end: 200,
      assemblyName: 'volvox',
    })
    expect(session.highlightsVisible).toBe(true)

    // removing one must not re-reveal, otherwise the toggle can't be turned off
    session.setHighlightsVisible(false)
    model.removeHighlight(model.highlight[0]!)
    expect(session.highlightsVisible).toBe(false)
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

  test('recoloring from the grid reveals the bands', () => {
    const model = setupHighlightModel()
    const session = getSession(model)
    model.addToHighlights({
      refName: 'ctgA',
      start: 100,
      end: 200,
      assemblyName: 'volvox',
    })
    // the highlight grid lists entries with the bands off, so a color picked
    // there has to bring them back or nothing appears to happen
    session.setHighlightsVisible(false)
    model.updateHighlight(model.highlight[0]!, { color: '#ff0000' })
    expect(session.highlightsVisible).toBe(true)
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

describe('declarative launch: highlight, nav, unknown keys', () => {
  function makeModel(init: InitState) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        ...init,
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
      expect(model.pendingLaunch).toBeUndefined()
    })
    expect(model.highlight.length).toBe(1)
  })

  // the sibling of the case above: not a re-entrant autorun pass (the drain
  // flag covers that) but a genuinely newer `init` arriving mid-apply, which is
  // what a programmatic re-launch does. Guarding the steps after each await with
  // a bare isAlive let the stale blob run to completion and append its bands
  // under the one that replaced it; installInitAutorun's `superseded` is the
  // check that covers both.
  test('an init replaced mid-apply stops instead of appending under its successor', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      tracklist: true,
      highlight: ['ctgA:100-200'],
    })
    // makeModel already setWidth(800), so the apply is parked on the tracklist
    // width-settle await — the window a re-launch lands in
    model.setLaunch({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      highlight: ['ctgA:300-400'],
    })
    await waitFor(() => {
      expect(model.pendingLaunch).toBeUndefined()
    })
    // only the successor's band, and it did get applied (the locstring is
    // 1-based closed, so 300-400 lands at interbase 299)
    expect(model.highlight.map(h => h.start)).toEqual([299])
  })

  // init.tracklist opens the drawer before navigating so the region is framed
  // at the width the drawer leaves behind. The "is a width change coming?"
  // question used to be answered with `!!session.visibleWidget`, which reads a
  // *minimized* drawer — a visibleWidget taking no width — as already open. But
  // showWidget un-minimizes it, so the view does narrow, after navigation had
  // already computed bpPerPx from the full width: the requested 1000bp then
  // occupied only part of the screen.
  test('init.tracklist waits for a minimized drawer to take its width back', async () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    session.addWidget('SomeOtherWidget', 'other')
    session.minimizeWidgetDrawer()
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-1000',
        tracklist: true,
      }),
    )
    model.setWidth(800)

    // stands in for the app's ResizeObserver: un-minimizing gives the drawer its
    // column back, which is what shrinks the view. Driven from here, after
    // yielding, rather than synchronously inside activateTrackSelector —
    // resizing in the same tick would hand navigation the narrowed width whether
    // or not it waited, and the test would pass against the bug.
    await waitFor(() => {
      expect(session.minimized).toBe(false)
    })
    model.setWidth(600)

    await waitFor(() => {
      expect(model.pendingLaunch).toBeUndefined()
    })
    expect(model.width).toBe(600)
    // the whole 1000bp is on screen, i.e. bpPerPx was computed from 600
    expect(model.width * model.bpPerPx).toBeCloseTo(1000, 0)
  })

  // displayedRegionNames used to sit behind the same "don't clobber existing
  // navigation" guard as the whole-genome fallback, so URL params layered onto a
  // defaultSession that had already navigated (&extendSession=true&regions=)
  // silently did nothing. An explicit region list is a navigation request.
  test('init.displayedRegionNames applies to an already-navigated view', async () => {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        ],
        assembly: 'volvox',
        displayedRegionNames: ['ctgB'],
      }),
    )
    model.setWidth(800)
    await waitFor(() => {
      expect(model.displayedRegions.map(r => r.refName)).toEqual(['ctgB'])
    })
  })

  // a name that matches nothing warns; it must not discard the navigation the
  // session already had, which the unconditional showAllRegionsInAssembly did
  test('init.displayedRegionNames matching nothing keeps existing regions', async () => {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        ],
        assembly: 'volvox',
        displayedRegionNames: ['nonexistent'],
      }),
    )
    model.setWidth(800)
    await waitFor(() => {
      expect(model.pendingLaunch).toBeUndefined()
    })
    expect(model.displayedRegions.map(r => r.refName)).toEqual(['ctgA'])
  })

  // a bare string is iterable, so `tracks: 'abc'` opened one track per letter
  test('init.tracks written as a bare string is one track, not one per letter', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      tracks: 'abc' as unknown as string[],
    })
    await waitFor(() => {
      expect(model.pendingLaunch).toBeUndefined()
    })
    // the stub session resolves no tracks, so each attempt notifies: exactly one
    expect((console.error as jest.Mock).mock.calls).toEqual([
      ['Error: Could not resolve identifier "abc"'],
    ])
  })

  // parseLocString throws on an unknown refName, and that throw escaped the
  // async autorun as an unhandled rejection, dropping every later entry
  test('a bad init.highlight entry is reported and the rest still apply', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      highlight: ['badref:1-100', 'ctgA:100-200'],
    })
    await waitFor(() => {
      expect(model.pendingLaunch).toBeUndefined()
    })
    expect(model.highlight.length).toBe(1)
    expect(model.highlight[0]!.refName).toBe('ctgA')
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid init highlight "badref:1-100"'),
    )
  })

  // it belongs on the view object, which is what the deprecation says — but a
  // nested one sorts the same three ways a flat one does, so it lands rather
  // than reading as a typo. The comparative views' v4 `init` applied a declared
  // property, and the shipped demos write one.
  test('a view prop nested inside init still lands on the property', async () => {
    const model = makeModel({
      assembly: 'volvox',
      loc: 'ctgA:1-1000',
      colorByCDS: true,
    } as InitState)
    await waitFor(() => {
      expect(model.pendingLaunch).toBeUndefined()
    })
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('ignored unknown key(s): colorByCDS'),
    )
    expect(model.colorByCDS).toBe(true)
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
        assembly: 'volvox',
        loc: 'ctgA:1-1000',
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
      expect(model.pendingLaunch).toBeUndefined()
    })
  })

  // `assembly` is required by InitState, but init is a frozen blob filled from
  // hand-authored config JSON, so the type guarantees nothing at runtime. The
  // import form renders `error`, and interpolating the missing name into it
  // produced the literal "Assembly undefined not found".
  test('init without an assembly names the authoring mistake', () => {
    const model = makeModel({ loc: 'ctgA:1-1000' } as InitState)
    expect(model.error).toBe('LinearGenomeView init needs an "assembly"')
    expect(model.showImportForm).toBe(true)
  })
})

describe('showsWholeChromosome', () => {
  function makeView(regions: unknown[]) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    // @ts-expect-error
    model.setDisplayedRegions(regions)
    return model
  }

  test('true for a region spanning the entire refseq', () => {
    expect(makeView([volvoxDisplayedRegions[0]]).showsWholeChromosome).toBe(
      true,
    )
  })

  test('false for a sub-region, so cytobands stay off', () => {
    const region = { ...volvoxDisplayedRegions[0]!, start: 100, end: 20000 }
    expect(makeView([region]).showsWholeChromosome).toBe(false)
  })

  test('false for multiple regions', () => {
    expect(makeView(volvoxDisplayedRegions).showsWholeChromosome).toBe(false)
  })
})

describe('coarse dynamic blocks', () => {
  function makeView() {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    model.setDisplayedRegions(volvoxDisplayedRegions)
    return model
  }

  // the location box reads coarseVisibleLocStrings, so a jump that leaves it to
  // the 500ms autorun shows the previous locus while the view is already there
  test('a navigation lands on them without waiting for the debounce', async () => {
    const model = makeView()
    await model.navToLocString('ctgA:1000-2000')
    expect(model.coarseVisibleLocStrings).toBe(model.visibleLocStrings)
  })

  test('an equivalent update does not invalidate consumers', async () => {
    const model = makeView()
    await model.navToLocString('ctgA:1000-2000')
    let runs = 0
    const dispose = autorun(() => {
      void model.coarseDynamicBlocks
      runs++
    })
    expect(runs).toBe(1)
    model.setCoarseDynamicBlocks(model.dynamicBlocks, model.bpPerPx)
    expect(runs).toBe(1)
    dispose()
  })

  // The window between a view initializing and the coarse autorun's first run.
  // A debounced scan clipped to an EMPTY block list yields no entries, and no
  // entries is not a stale domain but the fallback one — a blank wiggle plot.
  //
  // Regions in the SNAPSHOT, which is what a restored session does and the way
  // the window is still reachable: every placement action settles the coarse
  // blocks itself now, and a view that was never placed ran none of them.
  test('settledDynamicBlocks is the live set until the coarse one exists', () => {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: volvoxDisplayedRegions,
      }),
    )
    model.setWidth(800)

    expect(model.coarseDynamicBlocks).toHaveLength(0)
    expect(model.settledDynamicBlocks).toEqual(
      model.dynamicBlocks.contentBlocks,
    )
    expect(model.settledDynamicBlocks.length).toBeGreaterThan(0)
  })

  test('settledDynamicBlocks is the coarse set once it exists', () => {
    const model = makeView()
    model.setCoarseDynamicBlocks(model.dynamicBlocks, model.bpPerPx)
    expect(model.settledDynamicBlocks).toBe(model.coarseDynamicBlocks)

    // and it stays the coarse one through a move, which is the whole point of
    // the debounce: a stale answer, not a live one
    model.scrollTo(model.offsetPx + model.width * 3)
    expect(model.settledDynamicBlocks).toBe(model.coarseDynamicBlocks)
  })
})

// `settleCoarseBlocks` — the half `settledDynamicBlocks` cannot cover. That
// getter answers "the coarse blocks do not exist yet"; these answer "they exist
// and describe somewhere else". A jump is not a stale approximation of the new
// viewport, so every discrete placer settles them, and the continuous paths
// must not or the 500ms throttle stops throttling.
describe('a jump settles the coarse blocks', () => {
  // Regions in the SNAPSHOT — a restored session, the one arrangement that
  // places nothing — and the coarse set seeded directly. Neither depends on a
  // placer, so deleting the settle from the placer under test cannot also empty
  // the state the assertions measure against, which is how an empty coarse set
  // passes both of them by falling through to the live blocks.
  function makeView() {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: volvoxDisplayedRegions,
      }),
    )
    model.setWidth(800)
    model.setCoarseDynamicBlocks(model.dynamicBlocks, model.bpPerPx)
    return model
  }

  const keys = (blocks: { key: string }[]) => blocks.map(b => b.key)

  // Every placer that jumps. `placersSettleCoarseBlocks.test.ts` is what makes
  // a new one reach the settle; this is where it gets exercised end to end.
  // Except `clampZoomToCeiling`, which cannot be driven from here: only a
  // container lowering a shared ceiling puts a view above its own maxBpPerPx.
  // Its settle is asserted in LinearSyntenyView/sameScale.integration.test.ts.
  const jumps: [string, (model: LGV) => void][] = [
    [
      'setNewView',
      model => {
        model.setNewView(5, 0)
      },
    ],
    [
      'setWindow',
      model => {
        model.setWindow(9000, 12_000)
      },
    ],
    [
      'moveTo',
      model => {
        model.moveTo(
          { refName: 'ctgA', index: 0, offset: 1000, start: 0, end: 50000 },
          { refName: 'ctgA', index: 0, offset: 2000, start: 0, end: 50000 },
        )
      },
    ],
    // The worst of them if it were missed: the blocks are keyed by
    // `displayedRegionIndex`, so a coarse set that outlives the region list
    // names one contig while another is on screen, and a consumer keyed by that
    // index reads one region's data against the other's blocks.
    [
      'setDisplayedRegions',
      model => {
        model.setDisplayedRegions([volvoxDisplayedRegions[1]!])
      },
    ],
    [
      'showAllRegions',
      model => {
        model.showAllRegions()
      },
    ],
    [
      'fitAllRegions',
      model => {
        model.fitAllRegions()
      },
    ],
    // The region list again, and reversed with it: index 0 named ctgA forward
    // and names ctgB reversed afterwards, off a direct write to
    // `displayedRegions` rather than through setDisplayedRegions
    [
      'horizontallyFlip',
      model => {
        model.horizontallyFlip()
      },
    ],
    [
      'centerAt',
      model => {
        model.centerAt(40_000, 'ctgA')
      },
    ],
    [
      'showRegions',
      model => {
        model.showRegions([volvoxDisplayedRegions[1]!])
      },
    ],
  ]

  test.each(jumps)('%s brings them to the new viewport', (_name, jump) => {
    const model = makeView()
    const before = keys(model.coarseDynamicBlocks)
    expect(before.length).toBeGreaterThan(0)

    jump(model)

    expect(keys(model.coarseDynamicBlocks)).toEqual(
      keys(model.dynamicBlocks.contentBlocks),
    )
    expect(keys(model.coarseDynamicBlocks)).not.toEqual(before)
    expect(model.coarseBpPerPx).toBe(model.bpPerPx)
  })

  // The regression in the terms it was found in: a bigwig track's autoscale
  // domain is computed over `settledDynamicBlocks`, and a jump that left a 40bp
  // coarse window standing over 4040bp on screen scaled every bar by 200/300.
  // The fetch only started landing inside that window once it moved to the
  // leading edge.
  test.each(jumps)('%s leaves no per-bp scan on the old window', (_n, jump) => {
    const model = makeView()
    const before = keys(model.settledDynamicBlocks)
    expect(before.length).toBeGreaterThan(0)

    jump(model)

    expect(keys(model.settledDynamicBlocks)).toEqual(
      keys(model.dynamicBlocks.contentBlocks),
    )
    expect(keys(model.settledDynamicBlocks)).not.toEqual(before)
  })

  // The multi-locus branch places through `fitAllRegions` rather than `moveTo`,
  // and reached it as a second root action, so the settle inside the region
  // write landed on the window between the two and stayed there.
  test('a multi-region navigation lands on them too', async () => {
    const model = makeView()
    await model.navToLocString('ctgA:1000-2000 ctgB:1000-2000')
    expect(model.coarseVisibleLocStrings).toBe(model.visibleLocStrings)
  })

  // Consumers diff the coarse blocks by reference, so an intermediate viewport
  // is a round of per-bp scanning and fetching over a window nobody saw. The
  // region write and the placement have to be one action for that to hold —
  // post-await they are not inside `navToLocations`'s own action any more.
  test('a navigation publishes one coarse viewport, not two', async () => {
    const model = makeView()
    model.setWindow(2000, 30_000)
    const published: string[] = []
    const dispose = autorun(() => {
      published.push(keys(model.coarseDynamicBlocks).join('|'))
    })
    await model.navToLocString('ctgB:1000-2000')
    dispose()

    // the autorun's own first run, then the navigation's single update
    expect(published).toHaveLength(2)
    expect(published.at(-1)).toBe(
      keys(model.dynamicBlocks.contentBlocks).join('|'),
    )
  })

  // The other half, and the reason this is not simply "settle on every write":
  // the spring zoom writes through `zoomTo` per frame and a drag through
  // `scrollTo`, and settling there would recompute every coarse consumer per
  // frame — which is the cost the coarse blocks exist to avoid.
  const gestures: [string, (model: LGV) => void][] = [
    [
      'zoomTo',
      model => {
        model.zoomTo(model.bpPerPx * 2)
      },
    ],
    [
      'scrollTo',
      model => {
        model.scrollTo(model.offsetPx + 200)
      },
    ],
  ]

  test.each(gestures)('%s leaves them alone', (_name, gesture) => {
    const model = makeView()
    const settled = model.coarseDynamicBlocks

    gesture(model)

    expect(model.coarseDynamicBlocks).toBe(settled)
  })
})

// The one jump that takes time, so it cannot join the table above: it writes
// per frame through `setWindowFrame` and settles on the last of them. Which
// makes it both — a continuous path while it runs and a jump when it lands —
// and the two halves are what these assert. The path itself is `flyTo.test.ts`.
describe('flyTo', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  // A 2kb window at the left end, so `flyToCenter(40_000)` is a twenty-screen
  // hop — long enough to have a middle worth asserting about, and to outlast
  // the 100ms the mid-flight assertions advance by.
  function makeView() {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: volvoxDisplayedRegions,
      }),
    )
    model.setWidth(800)
    model.setWindow(2000, 0)
    model.setCoarseDynamicBlocks(model.dynamicBlocks, model.bpPerPx)
    return model
  }

  const keys = (blocks: { key: string }[]) => blocks.map(b => b.key)

  // Within a pixel of `centerAt` rather than equal to it: `centerAt` rounds its
  // scroll to a whole pixel, from when pixels were what the viewport was stored
  // as. Landing under the clamp and at the requested width is the part that has
  // to hold, since a caller's Undo and snackbar were written around the jump.
  test('lands where the jump would have landed', () => {
    const model = makeView()
    const jumped = makeView()
    jumped.centerAt(40_000, 'ctgA')

    model.flyToCenter(40_000, 'ctgA')
    jest.advanceTimersByTime(5000)

    expect(model.windowWidthBp).toBe(jumped.windowWidthBp)
    expect(Math.abs(model.windowStartBp - jumped.windowStartBp)).toBeLessThan(
      model.bpPerPx,
    )
  })

  test('settles the coarse blocks once it arrives', () => {
    const model = makeView()

    model.flyToCenter(40_000, 'ctgA')
    jest.advanceTimersByTime(5000)

    expect(keys(model.coarseDynamicBlocks)).toEqual(
      keys(model.dynamicBlocks.contentBlocks),
    )
  })

  // The other half of the same rule, and the reason `setWindowFrame` exists:
  // settling per frame would wake every coarse consumer sixty times a second —
  // the synteny follow's exact pass into an RPC each frame, two autoscale
  // domains into a full per-bp rescan.
  test('leaves them alone while it is still travelling', () => {
    const model = makeView()
    const settled = model.coarseDynamicBlocks

    model.flyToCenter(40_000, 'ctgA')
    jest.advanceTimersByTime(100)

    // the CENTER, not the left edge: the arc widens the window as it goes, so
    // the edge it is measured from runs backwards over the first half
    expect(model.windowStartBp + model.windowWidthBp / 2).toBeGreaterThan(1000)
    expect(model.coarseDynamicBlocks).toBe(settled)
  })

  // It pulls back to cover the distance and comes back in, so the middle of a
  // twenty-screen hop is nowhere near either end's zoom.
  test('is zoomed out in the middle and back in at the end', () => {
    const model = makeView()

    model.flyToCenter(40_000, 'ctgA')
    jest.advanceTimersByTime(200)
    const midFlight = model.windowWidthBp
    jest.advanceTimersByTime(5000)

    expect(midFlight).toBeGreaterThan(2000)
    expect(model.windowWidthBp).toBe(2000)
  })

  // Anything else moving the view owns it from that moment: a wheel zoom, a
  // drag, or the Undo on the snackbar the flight was launched with. Without
  // this the next frame writes straight over it.
  test('yields the moment something else moves the view', () => {
    const model = makeView()

    model.flyToCenter(40_000, 'ctgA')
    jest.advanceTimersByTime(100)
    model.setWindow(2000, 0)
    jest.advanceTimersByTime(5000)

    expect(model.windowStartBp).toBe(0)
    expect(model.windowWidthBp).toBe(2000)
  })

  // Two clicks in a row, where the second's first frame could land on exactly
  // what the first wrote — so the yield above cannot be what stops the first,
  // and both would drive the view frame about frame. It also has to inherit the
  // zoom the FIRST was heading for: read off the arc it interrupted, the second
  // click frames its destination at whatever width the pull-back had reached.
  test('a second flight takes over from the first', () => {
    const model = makeView()

    model.flyToCenter(40_000, 'ctgA')
    jest.advanceTimersByTime(100)
    model.flyToCenter(10_000, 'ctgA')
    jest.advanceTimersByTime(5000)

    const jumped = makeView()
    jumped.centerAt(10_000, 'ctgA')
    expect(Math.abs(model.windowStartBp - jumped.windowStartBp)).toBeLessThan(
      model.bpPerPx,
    )
  })

  // A destination the view is already at has no path to fly, and must still
  // arrive — synchronously, since there are no frames to arrive on.
  test('a destination already on screen is placed outright', () => {
    const model = makeView()
    model.setWindow(2000, 39_000)

    model.flyToCenter(40_000, 'ctgA')

    expect(model.windowStartBp).toBe(39_000)
  })
})

describe('scalebar coordinate labels', () => {
  function makeView(regions: { refName: string; end: number }[]) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    model.setDisplayedRegions(
      regions.map(({ refName, end }) => ({
        assemblyName: 'volvox',
        refName,
        start: 0,
        end,
      })),
    )
    model.showAllRegions()
    return model
  }

  test('a region with room for a real ruler is numbered', () => {
    const model = makeView([{ refName: 'ctgA', end: 100000 }])
    expect(model.scalebarLabels.length).toBeGreaterThan(1)
  })

  // whole-genome case: the pitch comes from the whole region set, so a short
  // chromosome catches one lone number that says nothing about scale and reads
  // as the same value repeated down a multi-genome row
  test('a region with room for only one label is left unnumbered', () => {
    const model = makeView([
      { refName: 'ctgA', end: 100000 },
      { refName: 'ctgB', end: 2000 },
    ])
    const [wide, narrow] = model.staticBlocks.contentBlocks
    expect(narrow!.widthPx).toBeLessThan(60)
    // keys are `${run.offsetPx}-${base}`, so every label still belongs to the
    // wide region and none to the narrow one
    expect(model.scalebarLabels.length).toBeGreaterThan(1)
    expect(
      model.scalebarLabels.every(l => l.key.startsWith(`${wide!.offsetPx}-`)),
    ).toBe(true)
  })
})

// `scalebarRefNameLabels` is what ScalebarRefNameLabels draws, as data. Two of
// its rules are the ones a host re-deriving this off block flags misses, and
// both are silent: a repeated name, and a name clipped into a different one.
describe('scalebar refName labels', () => {
  function makeView(regions: { refName: string; end: number }[]) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    model.setDisplayedRegions(
      regions.map(({ refName, end }) => ({
        assemblyName: 'volvox',
        refName,
        start: 0,
        end,
      })),
    )
    model.showAllRegions()
    return model
  }

  // two displayed regions of one contig — what a locstring with two intervals
  // on the same chromosome gives you, and what the byo scalebar page shows
  test('adjacent regions of one refName share a label', () => {
    const model = makeView([
      { refName: 'ctgA', end: 100000 },
      { refName: 'ctgA', end: 80000 },
    ])
    expect(model.scalebarRefNameLabels.labels.map(l => l.text)).toEqual([
      'ctgA',
    ])
  })

  test('a name that will not fit its region is dropped, not abbreviated', () => {
    const model = makeView([
      { refName: 'ctgA', end: 100000000 },
      { refName: 'a_very_long_contig_name', end: 2000000 },
    ])
    // the narrow region is still drawn -- it is a content block, not elided, so
    // the label is missing on the fit test rather than for want of a block
    const narrow = model.staticBlocks.contentBlocks.find(
      b => b.refName === 'a_very_long_contig_name',
    )
    expect(narrow).toBeDefined()
    expect(narrow!.widthPx).toBeGreaterThan(model.minimumBlockWidth)

    expect(model.scalebarRefNameLabels.labels.map(l => l.text)).toEqual([
      'ctgA',
    ])
  })

  // a plain LGV sets no assembly-name prefix; only a container view (synteny)
  // opts its sub-views in
  test('no prefix, so no prefix fallback', () => {
    const model = makeView([{ refName: 'ctgA', end: 100000 }])
    expect(model.scalebarRefNameLabels.caption).toBeUndefined()
  })
})

// The two label-menu items that shorten the region list write through
// setDisplayedRegionsKeepingCenter. Plain setDisplayedRegions carries offsetPx
// across and clamps it, which for a view scrolled past the end of what survives
// lands on the tail of the kept region plus blank space.
describe('shortening the region list keeps the viewport', () => {
  function makeView() {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 100000 },
    ])
    model.zoomTo(10)
    model.scrollTo(9000)
    return model
  }

  const ctgB = {
    assemblyName: 'volvox',
    refName: 'ctgB',
    start: 0,
    end: 100000,
  }

  test('the centered base survives dropping the regions before it', () => {
    const model = makeView()
    const before = model.pxToBp(model.width / 2)
    expect(before.refName).toBe('ctgB')

    setDisplayedRegionsKeepingCenter(model, [ctgB])

    const after = model.pxToBp(model.width / 2)
    expect(after.refName).toBe('ctgB')
    expect(Math.abs(after.coord0 - before.coord0)).toBeLessThanOrEqual(
      model.bpPerPx,
    )
  })

  // the clamp is still the only answer when the region under the middle is the
  // one being removed
  test('a region set without the centered region falls back to the clamp', () => {
    const model = makeView()
    setDisplayedRegionsKeepingCenter(model, [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
    ])
    expect(model.pxToBp(model.width / 2).refName).toBe('ctgA')
  })
})

// `paddingSpans` is what PaddingBlocks draws, as data, so a host writing its
// own chrome computes a seam the same way JBrowse does rather than re-deriving
// it off `isRightEndOfDisplayedRegion` and getting a thinner answer.
describe('padding spans', () => {
  function makeView(regions: { refName: string; end: number }[]) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    model.setDisplayedRegions(
      regions.map(({ refName, end }) => ({
        assemblyName: 'volvox',
        refName,
        start: 0,
        end,
      })),
    )
    model.showAllRegions()
    return model
  }

  // Regions are laid out contiguously, so the seam is the *only* marker between
  // two of them — there is no inter-region padding block to fall back on, and a
  // host that skips it renders two regions butted edge to edge.
  test('a seam at each region end, boundaries at the genome ends', () => {
    const model = makeView([
      { refName: 'ctgA', end: 100000 },
      { refName: 'ctgB', end: 80000 },
    ])
    expect(model.paddingSpans.map(s => s.kind)).toEqual([
      'boundary',
      'seam',
      'seam',
      'boundary',
    ])

    // the first seam sits at the first region's right edge, in the staticBlocks
    // frame that gridlineTicks and scalebarLabels also use
    const { contentBlocks, offsetPx: frame } = model.staticBlocks
    const firstRegionEnd = contentBlocks.findLast(
      b => b.displayedRegionIndex === 0,
    )!
    const seam = model.paddingSpans.find(s => s.kind === 'seam')!
    expect(seam.x).toBeCloseTo(
      firstRegionEnd.offsetPx + firstRegionEnd.widthPx - frame - 1,
    )
    expect(seam.width).toBe(3)
  })

  // A region under minimumBlockWidth (3px) elides. Whole-genome on a real
  // assembly is mostly these, so a host that draws only seams renders that
  // tail as nothing at all.
  test('a sub-pixel region is an elided span and gets no seam', () => {
    const model = makeView([
      { refName: 'ctgA', end: 100000000 },
      { refName: 'tiny', end: 50 },
    ])
    const elided = model.paddingSpans.filter(s => s.kind === 'elided')
    expect(elided).toHaveLength(1)
    expect(elided[0]!.width).toBeLessThan(model.minimumBlockWidth)

    // one seam, for ctgA -- not two. At the zoom where regions elide, a bar per
    // region is a solid grey wall, so an elided block carries the flag and is
    // deliberately not given one.
    expect(model.paddingSpans.filter(s => s.kind === 'seam')).toHaveLength(1)
  })
})

// `staticBlocksTranslateX` is the shift that carries the three frame-relative
// getters above onto the screen, and its whole reason for being a getter is
// that the subtraction has to happen in float64 -- a CSS length is float32 by
// the time it reaches the compositor, and `offsetPx` alone is far past where
// that is exact. See reference/BP_PRECISION.md, "The same hazard on the CSS
// side".
describe('staticBlocksTranslateX', () => {
  function makeView(end: number) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ type: 'LinearGenomeView' }),
    )
    model.setWidth(800)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end },
    ])
    return model
  }

  test('is the shift from the staticBlocks frame to the viewport', () => {
    const model = makeView(100000)
    model.showAllRegions()
    expect(model.staticBlocksTranslateX).toBeCloseTo(
      model.staticBlocks.offsetPx - model.offsetPx,
    )

    // a scroll moves it by exactly what it scrolled, and nothing else: the
    // frame-relative x values are what stay put
    const before = model.staticBlocksTranslateX
    const spansBefore = model.paddingSpans.map(s => s.x)
    model.horizontalScroll(120)
    expect(model.staticBlocksTranslateX).toBeCloseTo(before - 120)
    expect(model.paddingSpans.map(s => s.x)).toEqual(spansBefore)
  })

  // The claim the getter exists for. A human-sized chromosome at base
  // resolution puts offsetPx past 1e10, where float32 steps ~1024px at a time,
  // so an overlay translated by -offsetPx lands in a different part of the
  // genome. The difference stays inside the overhang, which is a block or two.
  test('stays small where offsetPx has left float32 behind', () => {
    const model = makeView(248_000_000)
    model.navTo({ refName: 'ctgA', start: 247_000_000, end: 247_000_016 })

    // a whole pixel of pan is invisible at this magnitude in single precision,
    // which is the failure mode: not a blurry line, a row in the wrong place
    expect(model.offsetPx).toBeGreaterThan(1e10)
    expect(Math.fround(model.offsetPx + 1)).toBe(Math.fround(model.offsetPx))

    expect(Math.abs(model.staticBlocksTranslateX)).toBeLessThan(
      model.staticBlocks.totalWidthPx,
    )
    // and what reaches CSS survives the round trip through single precision
    expect(Math.fround(model.staticBlocksTranslateX)).toBeCloseTo(
      model.staticBlocksTranslateX,
    )
  })
})

// A resize keeps the genomic window and rescales, rather than keeping bpPerPx
// and revealing/hiding sequence at the right edge. Keeping the scale was a
// block-cache optimization — block boundaries are a function of bpPerPx and
// their keys embed start/end, so holding bpPerPx across a resize repriced
// nothing — at the cost of a resize not meaning what a reader means by one.
describe('resize preserves the genomic window', () => {
  function edges(model: LGV) {
    return {
      start: Math.round(model.pxToBp(0).coord),
      end: Math.round(model.pxToBp(model.width).coord),
    }
  }

  function navigatedView(width: number) {
    const { Session, LinearGenomeModel } = initialize()
    const model = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({
        id: `resize-${width}`,
        type: 'LinearGenomeView',
      }),
    )
    model.setWidth(width)
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
    ])
    model.navTo({ refName: 'ctgA', start: 10000, end: 20000 })
    return model
  }

  test('narrowing rescales instead of truncating', () => {
    const model = navigatedView(1000)
    const before = edges(model)
    model.setWidth(500)
    expect(edges(model)).toEqual(before)
    expect(model.bpPerPx).toBeCloseTo(20)
  })

  test('widening rescales instead of revealing', () => {
    const model = navigatedView(500)
    const before = edges(model)
    model.setWidth(1000)
    expect(edges(model)).toEqual(before)
    expect(model.bpPerPx).toBeCloseTo(10)
  })

  test('a snapshot restores its window at a different width', () => {
    const authored = navigatedView(1000)
    const before = edges(authored)
    const snap = getSnapshot(authored)

    const { Session, LinearGenomeModel } = initialize()
    const restored = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create({ ...snap, id: 'restored' }),
    )
    restored.setWidth(500)

    // the bug this representation exists to fix: authored at 1000px, this used
    // to open at 500px showing 10,001-15,001 — half the region its author was
    // looking at — while the same location as a `&loc=` opened correctly. The
    // two ways to share a view disagreed.
    expect(edges(restored)).toEqual(before)
    expect(restored.bpPerPx).toBeCloseTo(20)
    // and the coarse scale the displays lay out and fetch against is seeded at
    // the measure, not 500ms later by the debounced autorun
    expect(restored.coarseBpPerPx).toBe(restored.bpPerPx)
  })

  test('a pre-window snapshot keeps its old behavior', () => {
    const { Session, LinearGenomeModel } = initialize()
    // no windowWidthBp: written before the window was stored, so the width its
    // pixels were measured at is unrecoverable and there is nothing to restore
    // but the scale itself. `bpPerPx`/`offsetPx` are no longer declared
    // properties, so only preProcessSnapshot accepts them — which is the thing
    // under test, and why the cast belongs here rather than being designed away.
    const legacySnapshot = {
      id: 'legacy',
      type: 'LinearGenomeView',
      bpPerPx: 10,
      offsetPx: 1000,
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
      ],
    } as unknown as Parameters<typeof LinearGenomeModel.create>[0]
    const restored = Session.create({ configuration: {} }).setView(
      LinearGenomeModel.create(legacySnapshot),
    )
    restored.setWidth(500)
    expect(restored.bpPerPx).toBe(10)
    expect(restored.offsetPx).toBe(1000)
    expect(restored.coarseBpPerPx).toBe(10)
    // and having adopted it, the view is on the new representation: a further
    // resize preserves the window rather than adopting again
    restored.setWidth(250)
    expect(restored.bpPerPx).toBe(20)
    expect(restored.offsetPx).toBe(500)
  })

  test('a resize round-trip returns to the original scale', () => {
    const model = navigatedView(1000)
    const before = { ...edges(model), bpPerPx: model.bpPerPx }
    model.setWidth(377)
    model.setWidth(1000)
    expect(edges(model)).toEqual({ start: before.start, end: before.end })
    expect(model.bpPerPx).toBeCloseTo(before.bpPerPx)
  })
})
