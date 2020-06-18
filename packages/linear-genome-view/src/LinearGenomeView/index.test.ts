import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
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
  .volatile(self => ({
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
  expect(model.maxBpPerPx).toEqual(10)
  model.setNewView(0.02, 0)

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
  expect(model.maxBpPerPx).toEqual(20)
  model.setNewView(0.02, 0)

  model.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
  model.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
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
    'could not find a region that completely contained "ctgA:20001..20100"',
  )

  expect(() => model.navTo({ refName: 'ctgA', start: 0, end: 20000 })).toThrow(
    'could not find a region that completely contained "ctgA:1..20000"',
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
  ).toThrow('Start of region ctgC:5001..10000 should be 1, but it is not')

  expect(() =>
    model.navToMultiple([
      { refName: 'ctgB', start: 0, end: 5000 },
      { refName: 'ctgC', start: 0, end: 5000 },
    ]),
  ).toThrow('End of region ctgB:1..5000 should be 10000, but it is not')

  expect(() =>
    model.navToMultiple([
      { refName: 'ctgA', start: 5000, end: 10000 },
      { refName: 'ctgA', start: 0, end: 5000 },
    ]),
  ).toThrow(
    'Entered location ctgA:1..5000 does not match with displayed regions',
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
    model.zoomToDisplayedRegions(
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 0,
        refName: 'ctgA',
      },
      {
        start: 0,
        index: 1,
        end: 6079,
        offset: 6079,
        refName: 'ctgB',
      },
    )
    largestBpPerPx = model.bpPerPx
    expect(model.offsetPx).toBe(0)
    expect(model.bpPerPx).toBeCloseTo(28)
  })

  it('can select if start and end object are swapped', () => {
    // should be same results as above test
    model.zoomToDisplayedRegions(
      {
        start: 0,
        index: 1,
        end: 6079,
        offset: 6079,
        refName: 'ctgB',
      },
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 0,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(0)
    expect(model.bpPerPx).toEqual(largestBpPerPx)
  })

  it('can select over one refSeq', () => {
    model.zoomToDisplayedRegions(
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 10000,
        refName: 'ctgA',
      },
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 35000,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(266)
    expect(model.bpPerPx).toBeCloseTo(18.796)
    expect(model.bpPerPx).toBeLessThan(largestBpPerPx)
  })

  it('can select one region with start and end outside of displayed region', () => {
    model.zoomToDisplayedRegions(
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 29000,
        refName: 'ctgA',
      },
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 50000,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(1202)
    expect(model.bpPerPx).toBe(12.5)
    expect(model.bpPerPx).toBeLessThan(largestBpPerPx)
  })

  it('can select over two regions in the same reference sequence', () => {
    model.zoomToDisplayedRegions(
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 35000,
        refName: 'ctgA',
      },
      {
        start: 0,
        index: 1,
        end: 6709,
        offset: 2000,
        refName: 'ctgB',
      },
    )
    expect(model.offsetPx).toBe(2282)
    expect(model.bpPerPx).toBeCloseTo(8.771)
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
        start: 0,
        index: 0,
        end: 50001,
        offset: 10000,
        refName: 'ctgA',
      },
      {
        start: 0,
        index: 0,
        end: 50001,
        offset: 15000,
        refName: 'ctgA',
      },
    )
    expect(model.offsetPx).toBe(142)
    expect(model.bpPerPx).toBeCloseTo(35.176)
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
    { assemblyName: 'volvox', start: 1000, end: 2000, refName: 'ctgA' },
  ])

  expect(model.bpToPx({ refName: 'ctgA', coord: 500 })).toBe(undefined)
})
