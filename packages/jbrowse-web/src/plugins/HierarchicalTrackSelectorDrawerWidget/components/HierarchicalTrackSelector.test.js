import { Provider } from 'mobx-react'
import { types } from 'mobx-state-tree'
import React from 'react'
import renderer from 'react-test-renderer'
import { BaseTrack } from '../../LinearGenomeView/models/model'
import { stateModel as Model } from '../index'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

const testModel = types.model('Category', {
  views: types.array(
    types.model('view', {
      id: types.identifier,
      tracks: types.map(BaseTrack),
    }),
  ),
  drawerWidgets: types.map(Model),
})

describe('HierarchicalTrackSelector drawer widget', () => {
  it('renders with just the required model elements', () => {
    const rootModel = testModel.create({
      views: [
        {
          id: 'testId',
          tracks: {},
        },
      ],
      drawerWidgets: {
        testId: { id: 'testId', type: 'HierarchicalTrackSelectorDrawerWidget' },
      },
    })
    const component = renderer.create(
      <Provider rootModel={rootModel}>
        <HierarchicalTrackSelector
          model={rootModel.drawerWidgets.get('testId')}
        />
      </Provider>,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renders with a couple of uncategorized tracks', () => {
    const rootModel = testModel.create({
      views: [
        {
          id: 'testId',
          tracks: {
            foo: { id: 'foo', name: 'Foo Track', type: 'AlignmentsTrack' },
            bar: { id: 'bar', name: 'Bar Track', type: 'AlignmentsTrack' },
          },
        },
      ],
      drawerWidgets: {
        testId: { id: 'testId', type: 'HierarchicalTrackSelectorDrawerWidget' },
      },
    })
    const component = renderer.create(
      <Provider rootModel={rootModel}>
        <HierarchicalTrackSelector
          model={rootModel.drawerWidgets.get('testId')}
        />
      </Provider>,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renders with a couple of categorized tracks', () => {
    const rootModel = testModel.create({
      views: [
        {
          id: 'testId',
          tracks: {
            foo: { id: 'foo', name: 'Foo Track', type: 'AlignmentsTrack' },
            bar: { id: 'bar', name: 'Bar Track', type: 'AlignmentsTrack' },
          },
        },
      ],
      drawerWidgets: {
        testId: { id: 'testId', type: 'HierarchicalTrackSelectorDrawerWidget' },
      },
    })
    rootModel.views[0].tracks
      .get('foo')
      .configuration.category.set(['Foo Category'])
    rootModel.views[0].tracks
      .get('bar')
      .configuration.category.set(['Foo Category', 'Bar Category'])
    const component = renderer.create(
      <Provider rootModel={rootModel}>
        <HierarchicalTrackSelector
          model={rootModel.drawerWidgets.get('testId')}
        />
      </Provider>,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
