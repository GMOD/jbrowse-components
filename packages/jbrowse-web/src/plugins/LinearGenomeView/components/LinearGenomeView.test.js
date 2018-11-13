import React from 'react'
import renderer from 'react-test-renderer'
import LinearGenomeView from './LinearGenomeView'
import { TestStub as Model } from '../models/model'

describe('LinearGenomeView genome view component', () => {
  it('renders with an empty model', () => {
    const model = Model.create({
      type: 'LinearGenomeView',
      offsetPx: 0,
      bpPerPx: 1,
      blocks: [{ refName: 'ctgA', start: 0, end: 100 }],
      tracks: [
        { id: 'foo', name: 'Foo Track', type: 'tester', height: 20 },
        { id: 'bar', name: 'Bar Track', type: 'tester', height: 20 },
        { id: 'baz', name: 'Baz Track', type: 'tester', height: 20 },
      ],
      controlsWidth: 100,
      width: 800,
    })
    const component = renderer.create(<LinearGenomeView model={model} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders one track, no blocks', () => {
    const model = Model.create({
      type: 'LinearGenomeView',
      offsetPx: 0,
      bpPerPx: 1,
      blocks: [],
      tracks: [{ id: 'foo', name: 'Foo Track', type: 'tester', height: 20 }],
      controlsWidth: 100,
      width: 800,
    })
    const component = renderer.create(<LinearGenomeView model={model} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders two tracks, two blocks', () => {
    const model = Model.create({
      type: 'LinearGenomeView',
      offsetPx: 0,
      bpPerPx: 1,
      blocks: [
        { refName: 'ctgA', start: 0, end: 100 },
        { refName: 'ctgB', start: 1000, end: 200 },
      ],
      tracks: [
        { id: 'foo', name: 'Foo Track', type: 'tester', height: 20 },
        { id: 'bar', name: 'Bar Track', type: 'tester', height: 20 },
      ],
      controlsWidth: 100,
      width: 800,
    })
    const component = renderer.create(<LinearGenomeView model={model} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
