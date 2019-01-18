import { types } from 'mobx-state-tree'
import { getConf } from '../../../configuration'
import configSchema from './configSchema'
import { TestStub as LinearGenomeModel } from '.'
import JBrowse from '../../../JBrowse'

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const root = types
    .model({
      view: types.maybe(LinearGenomeModel),
      config: configSchema,
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
      configuration: root.config,
    }),
  )

  expect(root.view.tracks[0]).toBeTruthy()
  expect(getConf(model, 'trackSelectorType')).toBe('hierarchical')
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

describe('block calculation', () => {
  it('can calculate some blocks 1', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toMatchSnapshot()
  })
  it('can calculate some blocks 2', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: 30,
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
          { assembly: 'volvox', refName: 'ctgB', start: 100, end: 200 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 3', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: 1000,
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
          { assembly: 'volvox', refName: 'ctgB', start: 100, end: 200 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toEqual([])
  })

  it('can calculate some blocks 4', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: -1000,
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
          { assembly: 'volvox', refName: 'ctgB', start: 100, end: 200 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toEqual([])
  })

  it('can calculate some blocks 5', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: 5000,
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
          { assembly: 'volvox', refName: 'ctgB', start: 100, end: 10000 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 6', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: 0,
        displayedRegions: [
          {
            assembly: 'volvox',
            refName: 'ctgA',
            start: 0,
            end: 200,
          },
          { assembly: 'volvox', refName: 'ctgB', start: 0, end: 1000 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 7', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: 801,
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 200 },
          { assembly: 'volvox', refName: 'ctgB', start: 0, end: 1000 },
        ],
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 8', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: 1600,
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 200 },
          { assembly: 'volvox', refName: 'ctgB', start: 0, end: 10000000 },
        ],
        configuration: 'fakeReference',
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 9', () => {
    const model = LinearGenomeModel.create(
      {
        type: 'LinearGenomeView',
        tracks: [{ name: 'foo track', type: 'tester' }],
        offsetPx: 1069,
        bpPerPx: 2,
        displayedRegions: [
          {
            assembly: 'volvox',
            refName: 'ctgA',
            start: 0,
            end: 50000,
          },
          { assembly: 'volvox', refName: 'ctgB', start: 0, end: 300 },
        ],
        configuration: 'fakeReference',
      },
      {
        testEnv: true,
      },
    )
    expect(model.blocks).toMatchSnapshot()
  })
})
