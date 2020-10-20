import { ConfigurationSchema } from '@jbrowse/core/configuration'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import PluginManager from '@jbrowse/core/PluginManager'
import { types, Instance } from 'mobx-state-tree'
import BaseTrack from '../BasicTrack/baseTrackModel'
import { stateModelFactory, LinearGenomeViewStateModel } from '.'

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
const stubManager = new PluginManager()
stubManager.addTrackType(
  () =>
    new TrackType({
      name: 'Base',
      compatibleView: 'LinearGenomeView',
      configSchema: ConfigurationSchema(
        'BaseTrack',
        {},
        { explicitlyTyped: true },
      ),
      stateModel: BaseTrack,
    }),
)
stubManager.createPluggableElements()
stubManager.configure()
const LinearGenomeModel = stateModelFactory(stubManager)

const Session = types
  .model({
    name: 'testSession',
    pluginManager: 'pluginManagerExists',
    view: types.maybe(LinearGenomeModel),
    configuration: types.map(types.string),
  })
  .actions(self => ({
    setView(view: Instance<LinearGenomeViewStateModel>) {
      self.view = view
      return view
    },
  }))
  .volatile((/* self */) => ({
    assemblyManager: new Map([
      [
        'volvox',
        {
          getCanonicalRefName(refName: string) {
            if (refName === 'contigA') {
              return 'ctgA'
            }
            return refName
          },
          get regions() {
            return [
              {
                assemblyName: 'volvox',
                start: 0,
                end: 50001,
                refName: 'ctgA',
                reversed: false,
              },
              {
                assemblyName: 'volvox',
                start: 0,
                end: 6079,
                refName: 'ctgB',
                reversed: false,
              },
            ]
          },
        },
      ],
    ]),
  }))

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'PileupTrack' }],
    }),
  )

  expect(model.tracks[0]).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
})

test('can instantiate a model that lets you navigate', () => {
  const session = Session.create({
    configuration: {},
  })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test1',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'PileupTrack' }],
    }),
  )
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
  ])
  model.setWidth(800)
  expect(model.maxBpPerPx).toEqual(10)
  model.setNewView(0.02, 0)

  expect(model.scaleBarHeight).toEqual(20)
  // header height 20 + area where polygons get drawn has height of 48
  expect(model.headerHeight).toEqual(68)
  expect(model.height).toBe(191)
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

test('can instantiate a model that has multiple displayed regions', () => {
  const session = Session.create({
    configuration: {},
  })
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test2',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'PileupTrack' }],
    }),
  )
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
  ])
  model.setWidth(800)
  expect(model.maxBpPerPx).toEqual(20)
  model.setNewView(0.02, 0)

  expect(model.offsetPx).toEqual(0)
  model.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
  expect(model.offsetPx).toEqual(800)
  model.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
  expect(model.offsetPx).toEqual(79401)
  model.centerAt(5000, 'ctgA', 1)
  expect(model.offsetPx).toEqual(79401)

  // length of ctgA 50000 and length of ctgB is 6080 = 56080
  expect(model.displayedParentRegionsLength).toEqual(56080)
  expect(model.idxInDisplayedRegion('ctgA')).toEqual(0)
  expect(model.bpToPx({ refName: 'ctgA', coord: 500 })).toEqual({
    index: 0,
    offsetPx: 3990,
  })
})

test('can instantiate a model that tests navTo/moveTo', async () => {
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test3',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'PileupTrack' }],
    }),
  )
  model.setWidth(width)
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
  ])
  expect(model.maxBpPerPx).toEqual(20)

  model.navTo({ refName: 'ctgA', start: 0, end: 100 })
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBe(0.125)

  model.navTo({ refName: 'ctgA' })
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBe(12.5)

  model.navTo({ refName: 'contigA', start: 0, end: 100 })
  expect(model.offsetPx).toBe(0)
  expect(model.bpPerPx).toBe(0.125)

  expect(() => model.navTo({ refName: 'ctgA', start: 200, end: 100 })).toThrow(
    'start "201" is greater than end "100"',
  )

  expect(() =>
    model.navTo({ refName: 'ctgDoesNotExist', start: 0, end: 100 }),
  ).toThrow('could not find a region with refName "ctgDoesNotExist"')

  expect(() => model.navTo({ refName: 'ctgA', end: 20100 })).toThrow(
    'could not find a region with refName "ctgA" that contained an end position 20100',
  )

  expect(() => model.navTo({ refName: 'ctgA', start: 20000 })).toThrow(
    'could not find a region with refName "ctgA" that contained a start position 20001',
  )

  expect(() =>
    model.navTo({ refName: 'ctgA', start: 20000, end: 20100 }),
  ).toThrow(
    'could not find a region that completely contained "ctgA:20,001..20,100"',
  )

  expect(() => model.navTo({ refName: 'ctgA', start: 0, end: 20000 })).toThrow(
    'could not find a region that completely contained "ctgA:1..20,000"',
  )
})

test('can navToMultiple', () => {
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
  expect(model.offsetPx).toBe(399)
  expect(model.bpPerPx).toBeCloseTo(12.531)

  model.navToMultiple([
    { refName: 'ctgA', start: 5000, end: 10000 },
    { refName: 'ctgB', start: 0, end: 10000 },
    { refName: 'ctgC', start: 0, end: 5000 },
  ])
  expect(model.offsetPx).toBe(199)
  expect(model.bpPerPx).toBeCloseTo(25.126)

  model.navToMultiple([
    { refName: 'ctgA', start: 5000, end: 10000 },
    { refName: 'ctgC', start: 0, end: 5000 },
  ])
  expect(model.offsetPx).toBe(2799)
  expect(model.bpPerPx).toBeCloseTo(12.531)

  expect(() =>
    model.navToMultiple([
      { refName: 'ctgB', start: 5000, end: 10000 },
      { refName: 'ctgC', start: 5000, end: 10000 },
    ]),
  ).toThrow('Start of region ctgC:5,001..10,000 should be 1, but it is not')

  expect(() =>
    model.navToMultiple([
      { refName: 'ctgB', start: 0, end: 5000 },
      { refName: 'ctgC', start: 0, end: 5000 },
    ]),
  ).toThrow('End of region ctgB:1..5,000 should be 10,000, but it is not')

  expect(() =>
    model.navToMultiple([
      { refName: 'ctgA', start: 5000, end: 10000 },
      { refName: 'ctgA', start: 0, end: 5000 },
    ]),
  ).toThrow(
    'Entered location ctgA:1..5,000 does not match with displayed regions',
  )
})

describe('Zoom to selected displayed regions', () => {
  let model: Instance<ReturnType<typeof stateModelFactory>>
  let largestBpPerPx: number
  beforeAll(() => {
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
    model.zoomToDisplayedRegions(
      {
        start: 5000,
        coord: 16193,
        index: 0,
        end: 20000,
        offset: 11193,
        refName: 'ctgA',
      },
      {
        start: 0,
        coord: 1437,
        index: 2,
        end: 3000,
        offset: 1437,
        refName: 'ctgB',
      },
    )
    largestBpPerPx = model.bpPerPx
    expect(model.offsetPx).toBe(584)
    expect(model.bpPerPx).toBeCloseTo(19.44, 0)
  })

  it('can select if start and end object are swapped', () => {
    // should be same results as above test
    model.zoomToDisplayedRegions(
      {
        start: 0,
        coord: 1437,
        index: 2,
        end: 3000,
        offset: 1437,
        refName: 'ctgB',
      },
      {
        start: 5000,
        coord: 16193,
        index: 0,
        end: 20000,
        offset: 11193,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(584)
    expect(model.bpPerPx).toBeCloseTo(19.44, 0)
  })

  it('can select over one refSeq', () => {
    model.zoomToDisplayedRegions(
      {
        start: 5000,
        index: 0,
        coord: 11364,
        end: 20000,
        offset: 6363.63,
        refName: 'ctgA',
      },
      {
        start: 5000,
        coord: 14829,
        index: 0,
        end: 20000,
        offset: 9828.28,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBeCloseTo(1469)
    expect(model.bpPerPx).toBeCloseTo(4.37, 0)
    expect(model.bpPerPx).toBeLessThan(largestBpPerPx)
  })

  it('can select one region with start and end outside of displayed region', () => {
    model.zoomToDisplayedRegions(
      {
        start: 5000,
        coord: 7369,
        index: 0,
        end: 20000,
        offset: 2368.69,
        refName: 'ctgA',
      },
      {
        start: 5000,
        coord: 3589,
        index: 0,
        end: 20000,
        offset: -1414.14,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(-299)
    expect(model.bpPerPx).toBeCloseTo(4.77, 0)
    expect(model.bpPerPx).toBeLessThan(largestBpPerPx)
  })

  it('can select over two regions in the same reference sequence', () => {
    model.zoomToDisplayedRegions(
      {
        start: 30000,
        coord: 38723,
        index: 1,
        end: 40000,
        offset: 8722.22,
        refName: 'ctgA',
      },
      {
        start: 0,
        coord: 1551,
        index: 1,
        end: 3000,
        offset: 1550.51,
        refName: 'ctgB',
      },
    )
    expect(model.offsetPx).toBe(1006420)
    expect(model.bpPerPx).toBeCloseTo(0.02, 0)
    expect(model.bpPerPx).toBeLessThan(largestBpPerPx)
  })

  it('can navigate to overlapping regions with a region between', () => {
    model.setDisplayedRegions([
      { assemblyName: 'volvox', refName: 'ctgA', start: 5000, end: 20000 },
      { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 3000 },
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 35000 },
    ])
    model.zoomToDisplayedRegions(
      {
        start: 5000,
        coord: 18786,
        index: 0,
        end: 20000,
        offset: 13785.35,
        refName: 'ctgA',
      },
      {
        start: 0,
        coord: 2812,
        index: 2,
        end: 35000,
        offset: 2811.87,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(1562)
    expect(model.bpPerPx).toBeCloseTo(8.92, 0)
  })
})

test('can instantiate a model that >2 regions', () => {
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test4',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'PileupTrack' }],
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
  expect(model.offsetPx).toEqual(10000 / model.bpPerPx + 2)
  expect(model.displayedRegionsTotalPx).toEqual(30000 / model.bpPerPx)
  model.showAllRegions()
  expect(model.offsetPx).toEqual(100)

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
  const session = Session.create({
    configuration: {},
  })
  const width = 800
  const model = session.setView(
    LinearGenomeModel.create({
      id: 'test5',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'PileupTrack' }],
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

  model.toggleHeader()
  expect(model.hideHeader).toEqual(true)
  model.toggleHeader()
  model.toggleHeaderOverview()
  expect(model.hideHeaderOverview).toEqual(true)
  model.toggleHeaderOverview()
  model.setError(Error('pxToBp failed to map to a region'))
  expect(model.error?.message).toEqual('pxToBp failed to map to a region')
})
