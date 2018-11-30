import { Provider } from 'mobx-react'
import { types } from 'mobx-state-tree'
import React from 'react'
import renderer from 'react-test-renderer'

import HierarchicalTrackSelectorPlugin from '../index'
import LinearGenomeView from '../../LinearGenomeView'

import PluginManager from '../../../PluginManager'

import modelFactory from '../model'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

const pluginManager = new PluginManager([
  LinearGenomeView,
  HierarchicalTrackSelectorPlugin,
]).configure()

const Model = modelFactory(pluginManager)

const testModel = types.model('FakeRoot', {
  views: types.array(
    types.model('view', {
      id: types.identifier,
      tracks: types.map(pluginManager.pluggableMstType('track', 'stateModel')),
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
        testId: {
          type: 'HierarchicalTrackSelectorDrawerWidget',
          view: 'testId',
        },
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
    rootModel.views[0].tracks[0].configuration.category.set(['Foo Category'])
    rootModel.views[0].tracks[1].configuration.category.set([
      'Foo Category',
      'Bar Category',
    ])
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
