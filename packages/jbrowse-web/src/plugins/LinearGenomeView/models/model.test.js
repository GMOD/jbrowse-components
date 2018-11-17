import { isType } from 'mobx-state-tree'
import { getConf } from '../../../configuration'
import { TestStub as LinearGenomeModel } from './model'

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const model = LinearGenomeModel.create({
    type: 'LinearGenomeView',
    tracks: { foo: { id: 'foo', name: 'foo track', type: 'AlignmentsTrack' } },
  })
  expect(model.tracks.get('foo')).toBeTruthy()
  expect(getConf(model, 'backgroundColor')).toBe('#eee')
})

describe('block calculation', () => {
  it('can calculate some blocks 1', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
      displayedRegions: [
        { assembly: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
      ],
    })
    expect(model.blocks).toMatchSnapshot()
  })
  it('can calculate some blocks 2', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
      offsetPx: 30,
      displayedRegions: [
        { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        { assembly: 'volvox', refName: 'ctgB', start: 100, end: 200 },
      ],
    })
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 3', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
      offsetPx: 1000,
      displayedRegions: [
        { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        { assembly: 'volvox', refName: 'ctgB', start: 100, end: 200 },
      ],
    })
    expect(model.blocks).toEqual([])
  })

  it('can calculate some blocks 4', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
      offsetPx: -1000,
      displayedRegions: [
        { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        { assembly: 'volvox', refName: 'ctgB', start: 100, end: 200 },
      ],
    })
    expect(model.blocks).toEqual([])
  })

  it('can calculate some blocks 5', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
      offsetPx: 5000,
      displayedRegions: [
        { assembly: 'volvox', refName: 'ctgA', start: 0, end: 10000 },
        { assembly: 'volvox', refName: 'ctgB', start: 100, end: 10000 },
      ],
    })
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 6', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
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
    })
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 7', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
      offsetPx: 801,
      displayedRegions: [
        { assembly: 'volvox', refName: 'ctgA', start: 0, end: 200 },
        { assembly: 'volvox', refName: 'ctgB', start: 0, end: 1000 },
      ],
    })
    expect(model.blocks).toMatchSnapshot()
  })

  it('can calculate some blocks 8', () => {
    const model = LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: { foo: { id: 'foo', name: 'foo track', type: 'tester' } },
      offsetPx: 1600,
      displayedRegions: [
        { assembly: 'volvox', refName: 'ctgA', start: 0, end: 200 },
        { assembly: 'volvox', refName: 'ctgB', start: 0, end: 10000000 },
      ],
    })
    expect(model.blocks).toMatchSnapshot()
  })
})
