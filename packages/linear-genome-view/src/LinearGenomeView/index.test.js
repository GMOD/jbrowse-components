import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { types } from 'mobx-state-tree'
import BaseTrack from '../BasicTrack/baseTrackModel'
import { stateModelFactory } from '.'

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
const stubManager = new PluginManager()
stubManager.addTrackType(
  () =>
    new TrackType({
      name: 'Base',
      stateModel: BaseTrack,
      RenderingComponent: true,
    }),
)
stubManager.configure()
const LinearGenomeModel = stateModelFactory(stubManager)

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const name = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
    })
    .actions(self => ({
      setView(view) {
        self.view = view
        return view
      },
    }))
    .create({
      config: {},
    })

  const model = name.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
    }),
  )

  expect(model.tracks[0]).toBeTruthy()
  expect(model.trackSelectorType).toBe('hierarchical')
})

test('can instantiate a model that lets you navigate', () => {
  const name = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
    })
    .actions(self => ({
      setView(view) {
        self.view = view
        return view
      },
    }))
    .create({
      config: {},
    })

  const model = name.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
      configuration: {},
    }),
  )
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
  ])
  expect(model.maxBpPerPx).toEqual(10)
  model.setNewView(0.02, 0)

  // test that it doesn't zoom in closer than 0.02
  model.zoomTo(0.01)
  expect(model.bpPerPx).toEqual(0.02) // clamped value

  // test some sanity values from zooming around
  model.setNewView(0.02, 0)
  expect(model.pxToBp(10).offset).toEqual(1)
  model.setNewView(0.1, 0)
  expect(model.pxToBp(100).offset).toEqual(11)
  model.setNewView(1, 0)
  expect(model.pxToBp(100).offset).toEqual(101)
  model.setNewView(10, 0)
  expect(model.pxToBp(100).offset).toEqual(1001)

  model.horizontallyFlip()

  // this is actually the same in reverse mode, the offset is a representation of linear bp offset not actual bp
  model.setNewView(0.02, 0)
  expect(model.pxToBp(10).offset).toEqual(1)
  model.setNewView(0.1, 0)
  expect(model.pxToBp(100).offset).toEqual(11)
  model.setNewView(1, 0)
  expect(model.pxToBp(100).offset).toEqual(101)
  model.setNewView(10, 0)
  expect(model.pxToBp(100).offset).toEqual(1001)
})

test('can instantiate a model that has multiple displayed regions', () => {
  const name = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
    })
    .actions(self => ({
      setView(view) {
        self.view = view
        return view
      },
    }))
    .create({
      config: {},
    })

  const model = name.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
      configuration: {},
    }),
  )
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
  ])
  expect(model.maxBpPerPx).toEqual(20)
  model.setNewView(0.02, 0)

  model.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
  expect(model.bpPerPx).toEqual(0.125)
  model.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
  expect(model.bpPerPx).toEqual(0.125)
  model.moveTo({ index: 0, offset: 9000 }, { index: 1, offset: 1000 })
  expect(model.bpPerPx).toEqual(2.5)
})

test('can instantiate a model that >2 regions', () => {
  const name = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.string),
    })
    .actions(self => ({
      setView(view) {
        self.view = view
        return view
      },
    }))
    .create({
      config: {},
    })

  const model = name.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
      configuration: {},
    }),
  )
  model.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgB' },
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgC' },
  ])
  model.moveTo({ index: 0, offset: 100 }, { index: 2, offset: 100 })
  expect(model.bpPerPx).toEqual(12.5)
})
