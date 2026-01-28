import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { stateModelFactory } from './index.ts'
import { BaseLinearDisplayComponent } from '../index.ts'
import hg38Regions from './hg38DisplayedRegions.json' with { type: 'json' }
import volvoxDisplayedRegions from './volvoxDisplayedRegions.json' with { type: 'json' }
import { stateModelFactory as LinearBasicDisplayStateModelFactory } from '../LinearBareDisplay/index.ts'

import type { LinearGenomeViewModel } from './index.ts'

type LGV = LinearGenomeViewModel

// use initializer function to avoid having console.warn jest.fn in a global
function initialize() {
  console.warn = jest.fn()
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
      {},
      { explicitlyTyped: true },
    )
    return new DisplayType({
      name: 'LinearBareDisplay',
      configSchema,
      stateModel: LinearBasicDisplayStateModelFactory(configSchema),
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
      getCanonicalRefName(refName: string) {
        if (refName === 'contigA') {
          return 'ctgA'
        }
        return refName
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
      waitForAssembly(str: string) {
        return self.assemblies.get(str)
      },
    }))
  const LinearGenomeModel = stateModelFactory(stubManager)
  const Session = types
    .model({
      name: 'testSession',
      rpcManager: 'rpcManagerExists',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
      assemblyManager: types.optional(AssemblyManager, {
        assemblies: {
          volvox: {
            // @ts-expect-error
            regions: volvoxDisplayedRegions,
          },
        },
      }),
    })
    .actions(self => ({
      setView(view: LGV) {
        self.view = view
        return view
      },
    }))

  return { Session, LinearGenomeModel, Assembly }
}

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
  expect(model.maxBpPerPx).toBeCloseTo(27.777)
  model.setNewView(0.02, 0)

  expect(model.offsetPx).toEqual(0)
  model.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
  expect(model.offsetPx).toEqual(800)
  model.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
  expect(model.offsetPx).toEqual(79401)
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
  expect(model.maxBpPerPx).toBeCloseTo(27.7777)

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
  expect(model.offsetPx).toBe(399)
  expect(model.bpPerPx).toBeCloseTo(12.531)

  model.navToMultiple([
    { refName: 'ctgA', start: 5000, end: 10000 },
    { refName: 'ctgB', start: 0, end: 10000 },
    { refName: 'ctgC', start: 0, end: 5000 },
  ])
  expect(model.offsetPx).toBe(199)
  expect(model.bpPerPx).toBeCloseTo(25.125)

  model.navToMultiple([
    { refName: 'ctgA', start: 5000, end: 10000 },
    { refName: 'ctgC', start: 0, end: 5000 },
  ])
  expect(model.offsetPx).toBe(199)
  expect(model.bpPerPx).toBeCloseTo(25.12562)
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
    expect(model.bpPerPx).toBeCloseTo(31.408)
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
    expect(model.bpPerPx).toBeCloseTo(38.8888)
    // totalBp = 28000 / 1000 = 28 as maxBpPerPx
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
    // 22000 / 792 (width - interRegionPadding) = 27.78
    expect(model.bpPerPx).toBeCloseTo(27.78, 0)
    // offset 5000 / bpPerPx (because that is the starting) = 180.5
    expect(model.offsetPx).toBe(181)
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
    // then 53000 / (width*0.9) = 73.6111
    expect(model.bpPerPx).toBeCloseTo(73.61111)
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
    expect(model.offsetPx).toBe(346)
    // 5000 + 3000 + 15000 / 792
    expect(model.bpPerPx).toBeCloseTo(29.04, 0)
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
  expect(model.displayedRegionsTotalPx).toEqual(30000 / model.bpPerPx)
  model.showAllRegions()
  expect(model.offsetPx).toEqual(-38)

  expect(model.bpToPx({ refName: 'ctgA', coord: 100 })).toEqual({
    index: 0,
    offsetPx: Math.round(100 / model.bpPerPx),
  })

  expect(model.bpToPx({ refName: 'ctgB', coord: 100 })).toEqual({
    index: 1,
    offsetPx: Math.round(10100 / model.bpPerPx) + model.interRegionPaddingWidth,
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
  // chr10 in the middle, tests a specific coord but should just be probably
  // somewhat around here
  expect(model.pxToBp(800).coord).toBe(111057351)
  expect(model.pxToBp(800).refName).toBe('10')

  // chrX after an elided block, this tests a specific coord but should just be
  // probably somewhat around here
  expect(model.pxToBp(1228).coord).toBe(1075410)
  expect(model.pxToBp(1228).refName).toBe('Y')

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
  it('handles when start or end offsets are out of bounds of displayed regions', () => {
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
    const outOfBounds = model.getSelectedRegions(
      model.leftOffset,
      model.rightOffset,
    )

    expect(outOfBounds.length).toEqual(1)
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
    expect(overlapping[0]!.start).toEqual(200)
    expect(overlapping[0]!.end).toEqual(500)
    expect(overlapping[1]!.start).toEqual(0)
    expect(overlapping[1]!.end).toEqual(3000)
    expect(overlapping[2]!.start).toEqual(0)
    expect(overlapping[2]!.end).toEqual(110)
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
      getCanonicalRefName(refName: string) {
        return refName.replace('chr', '')
      },
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
      waitForAssembly(str: string) {
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
})

test('showAllRegions accounts for inter-region padding when centering', () => {
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

  // Total BP = 3000
  // With 3 regions, there are 2 inter-region paddings = 4px
  // bpPerPx = 3000 / (900 * 0.9 - 4) = 3000 / 806 = 3.722
  // totalContentPx = 3000 / 3.722 + 4 = 806 + 4 = 810
  // centerPx = 405, offsetPx = 405 - 450 = -45

  expect(model.bpPerPx).toBeCloseTo(3.722, 2)
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

describe('getNonElidedRegionCount and getInterRegionPaddingPx', () => {
  test('counts all regions as non-elided when they are large enough', () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 2000 },
          { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 3000 },
        ],
      }),
    )
    model.setWidth(800)

    // At bpPerPx = 1, all regions are >= minimumBlockWidth (3px)
    expect(model.getNonElidedRegionCount(1)).toBe(3)
    expect(model.getInterRegionPaddingPx(1)).toBe(4) // 2 paddings * 2px
  })

  test('excludes small regions that would be elided', () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 5 }, // tiny
          { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 1000 },
        ],
      }),
    )
    model.setWidth(800)

    // At bpPerPx = 10, ctgB (5bp) = 0.5px < minimumBlockWidth (3px), so elided
    expect(model.getNonElidedRegionCount(10)).toBe(2)
    expect(model.getInterRegionPaddingPx(10)).toBe(2) // 1 padding * 2px
  })

  test('returns 0 padding when all regions are elided', () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10 },
          { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 10 },
        ],
      }),
    )
    model.setWidth(800)

    // At bpPerPx = 100, both 10bp regions = 0.1px < minimumBlockWidth (3px)
    expect(model.getNonElidedRegionCount(100)).toBe(0)
    expect(model.getInterRegionPaddingPx(100)).toBe(0)
  })

  test('handles edge case of bpPerPx = 0', () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 2000 },
        ],
      }),
    )
    model.setWidth(800)

    // bpPerPx = 0 should return all regions (avoid division by zero)
    expect(model.getNonElidedRegionCount(0)).toBe(2)
  })
})

describe('center behavior with content that does not fit', () => {
  test('scrolls to 0 when content is wider than screen', () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
        ],
        bpPerPx: 1, // Content = 10000px, much wider than screen
      }),
    )
    model.setWidth(800)

    model.center()

    // Content (10000px) > width (800px), so should scroll to 0
    expect(model.offsetPx).toBe(0)
  })

  test('centers when content fits on screen', () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })
    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 400 },
        ],
        bpPerPx: 1, // Content = 400px
      }),
    )
    model.setWidth(800)

    model.center()

    // Content (400px) < width (800px), so should center
    // centerPx = 200, targetOffset = 200 - 400 = -200
    expect(model.offsetPx).toBe(-200)
  })
})

describe('maxBpPerPx accounts for elided regions', () => {
  test('maxBpPerPx does not over-account for padding with many small regions', () => {
    const { Session, LinearGenomeModel } = initialize()
    const session = Session.create({ configuration: {} })

    // Create many small regions that will be elided at max zoom out
    const regions = []
    for (let i = 0; i < 100; i++) {
      regions.push({
        assemblyName: 'volvox',
        refName: `ctg${i}`,
        start: 0,
        end: 100, // 100bp each
      })
    }

    const model = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        displayedRegions: regions,
      }),
    )
    model.setWidth(800)

    // Total BP = 10000
    // At naive maxBpPerPx = 10000 / (800 * 0.9) = 13.89
    // Each 100bp region = 100 / 13.89 = 7.2px > minimumBlockWidth (3px)
    // So all 100 regions are non-elided, 99 paddings = 198px
    // Adjusted maxBpPerPx = 10000 / (720 - 198) = 10000 / 522 = 19.16

    expect(model.maxBpPerPx).toBeGreaterThan(13.89) // Should be higher due to padding
    expect(model.maxBpPerPx).toBeLessThan(100) // But not unreasonably high
  })
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
        {},
        { explicitlyTyped: true },
      )
      return new DisplayType({
        name: 'LinearBareDisplay',
        configSchema,
        stateModel: LinearBasicDisplayStateModelFactory(configSchema),
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
        getCanonicalRefName(refName: string) {
          return refName
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
        waitForAssembly(str: string) {
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
              // @ts-expect-error
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
        getTracksById() {
          return trackConfigs
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
