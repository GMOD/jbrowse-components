import { Provider } from 'mobx-react'
import React from 'react'
import renderer from 'react-test-renderer'
import { TestStub as Model } from '../models/model'
import LinearGenomeView from './LinearGenomeView'

describe('LinearGenomeView genome view component', () => {
  it('renders with an empty model', () => {
    const model = Model.create(
      {
        type: 'LinearGenomeView',
        offsetPx: 0,
        bpPerPx: 1,
        tracks: [],
        controlsWidth: 100,
      },
      {
        testEnv: true,
      },
    )
    const component = renderer.create(
      <Provider rootModel={{}}>
        <LinearGenomeView model={model} />
      </Provider>,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders one track, no blocks', () => {
    const model = Model.create(
      {
        type: 'LinearGenomeView',
        offsetPx: 0,
        bpPerPx: 1,
        blocks: [],
        tracks: [{ id: 'foo', name: 'Foo Track', type: 'tester', height: 20 }],
        controlsWidth: 100,
      },
      {
        testEnv: true,
      },
    )
    const component = renderer.create(
      <Provider rootModel={{}}>
        <LinearGenomeView model={model} />
      </Provider>,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders two tracks, two regions', () => {
    const model = Model.create(
      {
        type: 'LinearGenomeView',
        offsetPx: 0,
        bpPerPx: 1,
        displayedRegions: [
          { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
          { assembly: 'volvox', refName: 'ctgB', start: 1000, end: 200 },
        ],
        tracks: [
          { id: 'foo', name: 'Foo Track', type: 'tester', height: 20 },
          { id: 'bar', name: 'Bar Track', type: 'tester', height: 20 },
        ],
        controlsWidth: 100,
      },
      {
        testEnv: true,
      },
    )
    const component = renderer.create(
      <Provider rootModel={{}}>
        <LinearGenomeView model={model} />
      </Provider>,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
