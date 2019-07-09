import React from 'react'
import { render } from 'react-testing-library'
import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}

describe('HierarchicalTrackSelector drawer widget', () => {
  it('renders with just the required model elements', async () => {
    const { session } = await createTestEnv()
    const firstView = session.addView('LinearGenomeView')
    firstView.activateTrackSelector()
    const model = session.drawerWidgets.get('hierarchicalTrackSelector')

    const { container } = render(<HierarchicalTrackSelector model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with a couple of uncategorized tracks', async () => {
    const { session } = await createTestEnv({
      assemblies: [
        {
          assemblyName: 'volvox',
          sequence: {
            adapter: {
              type: 'FromConfigAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 10,
                  seq: 'cattgttgcg',
                },
              ],
            },
          },
          tracks: [
            {
              configId: 'fooC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
            {
              configId: 'barC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
          ],
        },
      ],
    })
    const firstView = session.addLinearGenomeViewOfAssembly('volvox', {})
    firstView.showTrack(session.configuration.assemblies[0].tracks[0])
    firstView.showTrack(session.configuration.assemblies[0].tracks[1])
    firstView.activateTrackSelector()
    const model = session.drawerWidgets.get('hierarchicalTrackSelector')

    const { container } = render(<HierarchicalTrackSelector model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with a couple of categorized tracks', async () => {
    const { session } = await createTestEnv({
      assemblies: [
        {
          assemblyName: 'volvox',
          sequence: {
            adapter: {
              type: 'FromConfigAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 10,
                  seq: 'cattgttgcg',
                },
              ],
            },
          },
          tracks: [
            {
              configId: 'fooC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
            {
              configId: 'barC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
          ],
        },
      ],
    })
    const firstView = session.addLinearGenomeViewOfAssembly('volvox', {})
    firstView.showTrack(session.configuration.assemblies[0].tracks[0])
    firstView.showTrack(session.configuration.assemblies[0].tracks[1])
    firstView.tracks[0].configuration.category.set(['Foo Category'])
    firstView.tracks[1].configuration.category.set([
      'Foo Category',
      'Bar Category',
    ])
    firstView.activateTrackSelector()
    const model = session.drawerWidgets.get('hierarchicalTrackSelector')

    const { container } = render(<HierarchicalTrackSelector model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
