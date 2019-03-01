import React from 'react'
import renderer from 'react-test-renderer'
import { createTestEnv } from '../../../JBrowse'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

describe('HierarchicalTrackSelector drawer widget', () => {
  it('renders with just the required model elements', async () => {
    const { rootModel } = await createTestEnv()
    rootModel.addDrawerWidget(
      'HierarchicalTrackSelectorDrawerWidget',
      'hierarchicalTrackSelectorDrawerWidget',
    )
    const model = rootModel.drawerWidgets.get(
      'hierarchicalTrackSelectorDrawerWidget',
    )

    const component = renderer.create(
      <HierarchicalTrackSelector model={model} />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renders with a couple of uncategorized tracks', async () => {
    const { rootModel } = await createTestEnv({
      tracks: [
        { configId: 'fooC', type: 'AlignmentsTrack' },
        { configId: 'barC', type: 'AlignmentsTrack' },
      ],
    })
    rootModel.addDrawerWidget(
      'HierarchicalTrackSelectorDrawerWidget',
      'hierarchicalTrackSelectorDrawerWidget',
    )
    const model = rootModel.drawerWidgets.get(
      'hierarchicalTrackSelectorDrawerWidget',
    )

    const component = renderer.create(
      <HierarchicalTrackSelector model={model} />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renders with a couple of categorized tracks', async () => {
    const { rootModel } = await createTestEnv({
      tracks: [
        { configId: 'fooC', type: 'AlignmentsTrack' },
        { configId: 'barC', type: 'AlignmentsTrack' },
      ],
    })
    rootModel.addDrawerWidget(
      'HierarchicalTrackSelectorDrawerWidget',
      'hierarchicalTrackSelectorDrawerWidget',
    )
    const model = rootModel.drawerWidgets.get(
      'hierarchicalTrackSelectorDrawerWidget',
    )

    const firstView = rootModel.addView('LinearGenomeView')
    firstView.showTrack(rootModel.configuration.tracks[0])
    firstView.showTrack(rootModel.configuration.tracks[1])
    firstView.tracks[0].configuration.category.set(['Foo Category'])
    firstView.tracks[1].configuration.category.set([
      'Foo Category',
      'Bar Category',
    ])
    const component = renderer.create(
      <HierarchicalTrackSelector model={model} />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
