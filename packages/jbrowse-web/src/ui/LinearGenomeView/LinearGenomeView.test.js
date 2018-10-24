import React from 'react'
import renderer from 'react-test-renderer'
import LinearGenomeView from './LinearGenomeView'

describe('linear genome view component', () => {
  it('renders with no props', () => {
    const component = renderer.create(<LinearGenomeView />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders one track, no blocks', () => {
    const blocks = []
    const tracks = [{ id: 'foo', height: 20 }]
    const component = renderer.create(
      <LinearGenomeView blocks={blocks} tracks={tracks} />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders two tracks, two blocks', () => {
    const blocks = [
      { refName: 'ctgA', start: 200, end: 400 },
      { refName: 'ctgA', start: 400, end: 600 },
    ]
    const tracks = [{ id: 'foo', height: 20 }]
    const component = renderer.create(
      <LinearGenomeView blocks={blocks} tracks={tracks} />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
