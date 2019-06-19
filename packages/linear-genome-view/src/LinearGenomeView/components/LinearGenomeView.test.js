import React from 'react'
import renderer from 'react-test-renderer'
import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import LinearGenomeView from './LinearGenomeView'

describe('LinearGenomeView genome view component', () => {
  it('renders with an empty model', async () => {
    const { rootModel } = await createTestEnv({
      defaultSession: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 1,
            tracks: [],
            controlsWidth: 100,
            configuration: {},
          },
        ],
      },
    })
    const model = rootModel.views[0]
    const component = renderer.create(<LinearGenomeView model={model} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders one track, no blocks', async () => {
    const { rootModel } = await createTestEnv({
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
              configId: 'testConfig',
              name: 'Foo Track',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
          ],
        },
      ],
      defaultSession: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 1,
            tracks: [
              {
                id: 'foo',
                type: 'BasicTrack',
                height: 20,
                configuration: 'testConfig',
              },
            ],
            controlsWidth: 100,
            configuration: {},
          },
        ],
      },
    })
    const model = rootModel.views[0]
    const component = renderer.create(<LinearGenomeView model={model} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('renders two tracks, two regions', async () => {
    const { rootModel } = await createTestEnv({
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
              configId: 'testConfig',
              name: 'Foo Track',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
            {
              configId: 'testConfig2',
              name: 'Bar Track',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
          ],
        },
      ],
      defaultSession: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 1,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
              {
                assemblyName: 'volvox',
                refName: 'ctgB',
                start: 1000,
                end: 200,
              },
            ],
            tracks: [
              {
                id: 'foo',
                type: 'BasicTrack',
                height: 20,
                configuration: 'testConfig',
              },
              {
                id: 'bar',
                type: 'BasicTrack',
                height: 20,
                configuration: 'testConfig2',
              },
            ],
            controlsWidth: 100,
            configuration: {},
          },
        ],
      },
    })
    const model = rootModel.views[0]
    const component = renderer.create(<LinearGenomeView model={model} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
