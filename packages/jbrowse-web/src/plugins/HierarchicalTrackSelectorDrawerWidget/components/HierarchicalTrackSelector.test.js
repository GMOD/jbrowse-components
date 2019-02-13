import { Provider } from 'mobx-react'
import React from 'react'
import renderer from 'react-test-renderer'
import JBrowse from '../../../JBrowse'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

describe('HierarchicalTrackSelector drawer widget', () => {
  let jbrowse

  beforeAll(async () => {
    jbrowse = await new JBrowse().configure()
  })

  it('renders with just the required model elements', () => {
    const rootModel = jbrowse.modelType.create({
      views: [
        {
          id: 'view1',
          type: 'LinearGenomeView',
        },
      ],
      drawerWidgets: {
        testId: {
          type: 'HierarchicalTrackSelectorDrawerWidget',
          view: 'view1',
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
    const rootModel = jbrowse.modelType.create({
      views: [
        {
          id: 'testId',
          type: 'LinearGenomeView',
          tracks: [
            { id: 'foo', type: 'AlignmentsTrack', configuration: 'fooC' },
            { id: 'bar', type: 'AlignmentsTrack', configuration: 'barC' },
          ],
        },
      ],
      drawerWidgets: {
        testId: { id: 'testId', type: 'HierarchicalTrackSelectorDrawerWidget' },
      },
      configuration: {
        tracks: [
          { configId: 'fooC', type: 'AlignmentsTrack' },
          { configId: 'barC', type: 'AlignmentsTrack' },
        ],
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
    const rootModel = jbrowse.modelType.create({
      views: [
        {
          id: 'testId',
          type: 'LinearGenomeView',
          tracks: [
            { id: 'foo', type: 'AlignmentsTrack', configuration: 'fooC' },
            { id: 'bar', type: 'AlignmentsTrack', configuration: 'barC' },
          ],
        },
      ],
      drawerWidgets: {
        testId: { id: 'testId', type: 'HierarchicalTrackSelectorDrawerWidget' },
      },
      configuration: {
        tracks: [
          { configId: 'fooC', type: 'AlignmentsTrack' },
          { configId: 'barC', type: 'AlignmentsTrack' },
        ],
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
