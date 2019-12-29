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
      configSchema: ConfigurationSchema(
        'BaseTrack',
        {},
        { explicitlyTyped: true },
      ),
      stateModel: BaseTrack,
      RenderingComponent: true,
    }),
)
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

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const model = Session.create({
    configuration: {},
  }).setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
    }),
  )

  expect(model.tracks[0]).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
})

test('can instantiate a model that lets you navigate', () => {
  const model = Session.create({
    configuration: {},
  })
  const view = model.setView(
    LinearGenomeModel.create({
      id: 'test1',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
    }),
  )
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
  ])
  expect(view.maxBpPerPx).toEqual(10)
  view.setNewView(0.02, 0)

  // test that it doesn't zoom in closer than 0.02
  view.zoomTo(0.01)
  expect(view.bpPerPx).toEqual(0.02) // clamped value

  // test some sanity values from zooming around
  view.setNewView(0.02, 0)
  expect(view.pxToBp(10).offset).toEqual(1)
  view.setNewView(0.1, 0)
  expect(view.pxToBp(100).offset).toEqual(11)
  view.setNewView(1, 0)
  expect(view.pxToBp(100).offset).toEqual(101)
  view.setNewView(10, 0)
  expect(view.pxToBp(100).offset).toEqual(1001)

  view.horizontallyFlip()

  // this is actually the same in reverse mode, the offset is a representation of linear bp offset not actual bp
  view.setNewView(0.02, 0)
  expect(view.pxToBp(10).offset).toEqual(1)
  view.setNewView(0.1, 0)
  expect(view.pxToBp(100).offset).toEqual(11)
  view.setNewView(1, 0)
  expect(view.pxToBp(100).offset).toEqual(101)
  view.setNewView(10, 0)
  expect(view.pxToBp(100).offset).toEqual(1001)
})

test('can instantiate a model that has multiple displayed regions', () => {
  const model = Session.create({
    configuration: {},
  })
  const view = model.setView(
    LinearGenomeModel.create({
      id: 'test2',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
    }),
  )
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
  ])
  expect(view.maxBpPerPx).toEqual(20)
  view.setNewView(0.02, 0)

  view.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
  expect(view.bpPerPx).toEqual(0.125)
  view.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
  expect(view.bpPerPx).toEqual(0.125)
  view.moveTo({ index: 0, offset: 9000 }, { index: 1, offset: 1000 })
  expect(view.bpPerPx).toEqual(2.5)
})

test('can instantiate a model that tests navTo/moveTo', () => {
  const model = Session.create({
    configuration: {},
  })
  const view = model.setView(
    LinearGenomeModel.create({
      id: 'test3',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
    }),
  )
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
  ])
  expect(view.maxBpPerPx).toEqual(20)

  view.navTo({ refName: 'ctgA', start: 0, end: 100 })
  expect(view.bpPerPx).toEqual(100 / 800)
  view.navTo({ refName: 'ctgA', start: 0, end: 20000 })
  expect(view.bpPerPx).toEqual(100 / 800) // did nothing
  view.navTo({ refName: 'ctgA' })
  expect(view.offsetPx).toEqual(0)
  expect(view.bpPerPx).toEqual(10000 / 800)
})

test('can instantiate a model that >2 regions', () => {
  const model = Session.create({
    configuration: {},
  })
  const view = model.setView(
    LinearGenomeModel.create({
      id: 'test4',
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
    }),
  )
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgC' },
  ])
  view.moveTo({ index: 0, offset: 100 }, { index: 2, offset: 100 })
  expect(view.bpPerPx).toEqual(20000 / 800)
  view.setNewView(1, 0)

  // extending in the minus gives us first displayed region
  expect(view.pxToBp(-5000).refName).toEqual('ctgA')
  expect(view.pxToBp(5000).refName).toEqual('ctgA')
  expect(view.pxToBp(15000).refName).toEqual('ctgB')
  expect(view.pxToBp(25000).refName).toEqual('ctgC')
  // extending past gives us the last displayed region
  expect(view.pxToBp(35000).refName).toEqual('ctgC')

  view.setDisplayName('Volvox view')
  expect(view.displayName).toBe('Volvox view')
  view.moveTo(
    { refName: 'ctgA', index: 0, offset: 0, start: 0, end: 10000 },
    { refName: 'ctgC', index: 2, offset: 0, start: 0, end: 10000 },
  )
  expect(view.bpPerPx).toEqual(20000 / 800)
  view.moveTo(
    { refName: 'ctgB', index: 1, offset: 0, start: 0, end: 10000 },
    { refName: 'ctgC', index: 2, offset: 0, start: 0, end: 10000 },
  )
  expect(view.bpPerPx).toEqual(10000 / 800)
  expect(view.offsetPx).toEqual(10000 / view.bpPerPx)
  expect(view.displayedRegionsTotalPx).toEqual(2400)
  view.showAllRegions()
  expect(view.bpPerPx).toEqual(30000 / 800)
  expect(view.offsetPx).toEqual(0)

  expect(view.bpToPx({ refName: 'ctgA', coord: 100 })).toEqual({
    index: 0,
    offsetPx: 3,
  })

  expect(view.bpToPx({ refName: 'ctgB', coord: 100 })).toEqual({
    index: 1,
    offsetPx: 269,
  })
})
