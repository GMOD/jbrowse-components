import { types } from 'mobx-state-tree'
import { getConf } from '../../../configuration'
import { TestStub as LinearGenomeModel } from '.'
import JBrowse from '../../../JBrowse'

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const root = types
    .model({
      view: types.maybe(LinearGenomeModel),
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

  const model = root.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      configuration: {},
    }),
  )

  expect(root.view.tracks[0]).toBeTruthy()
  expect(getConf(model, 'trackSelectorType')).toBe('hierarchical')
})

test("can instantiate a model that let's you navigate", () => {
  const root = types
    .model({
      view: types.maybe(LinearGenomeModel),
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

  const model = root.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
      displayedRegions: [
        { start: 0, end: 10000, refName: 'ctgA', assemblyName: 'volvox' },
      ],
      configuration: {},
    }),
  )
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

  model.configuration.reversed.set(true)

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
  const root = types
    .model({
      view: types.maybe(LinearGenomeModel),
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

  const model = root.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [{ name: 'foo track', type: 'AlignmentsTrack' }],
      controlsWidth: 0,
      displayedRegions: [
        { start: 0, end: 10000, refName: 'ctgA', assemblyName: 'volvox' },
        { start: 0, end: 10000, refName: 'ctgB', assemblyName: 'volvox' },
      ],
      configuration: {},
    }),
  )
  expect(model.maxBpPerPx).toEqual(20)
  model.setNewView(0.02, 0)

  model.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 200 })
  expect(model.bpPerPx).toEqual(0.125)
  model.moveTo({ index: 0, offset: 9950 }, { index: 1, offset: 50 })
  expect(model.bpPerPx).toEqual(0.125)
  model.moveTo({ index: 0, offset: 9000 }, { index: 1, offset: 1000 })
  expect(model.bpPerPx).toEqual(2.5)
})

it('can run configuration', () => {
  const jb = new JBrowse().configure({
    views: {
      LinearGenomeView: {},
    },
  })
  const { model } = jb
  const view = model.addView('LinearGenomeView')
  view.activateConfigurationUI()
})
