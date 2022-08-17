import '@testing-library/jest-dom/extend-expect'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import 'requestidlecallback-polyfill'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})
const mv = {
  id: 'MiDMyyWpxp',
  // @ts-ignore
  type: 'MultilevelLinearView',
  displayName: 'MLLV Default',
  linkViews: true,
  views: [
    {
      id: 'MoMeeVade',
      // @ts-ignore
      type: 'LinearGenomeMultilevelView',
      displayName: 'Overview',
      bpPerPx: 100000,
      isOverview: true,
      displayedRegions: [
        {
          refName: 'ctgA',
          start: 0,
          end: 186700647,
          assemblyName: 'volMyt1',
        },
      ],
      tracks: [
        {
          id: 'foo',
          type: 'BasicTrack',
          height: 20,
          configuration: 'testConfig',
          displays: [
            {
              type: 'LinearBareDisplay',
              configuration: 'testConfig-LinearBareDisplay',
            },
          ],
        },
      ],
    },
    {
      id: 'MoMeeVasdfade',
      // @ts-ignore
      type: 'LinearGenomeMultilevelView',
      displayName: 'Region',
      bpPerPx: 100,
      displayedRegions: [
        {
          refName: 'ctgA',
          start: 0,
          end: 186700647,
          assemblyName: 'volMyt1',
        },
      ],
      tracks: [
        {
          id: 'foo',
          type: 'BasicTrack',
          height: 20,
          configuration: 'testConfig',
          displays: [
            {
              type: 'LinearBareDisplay',
              configuration: 'testConfig-LinearBareDisplay',
            },
          ],
        },
      ],
    },
    {
      id: 'MoasdfMeeVade',
      // @ts-ignore
      type: 'LinearGenomeMultilevelView',
      displayName: 'Details',
      bpPerPx: 1,
      isAnchor: true,
      displayedRegions: [
        {
          refName: 'ctgA',
          start: 85313457,
          end: 85313457,
          assemblyName: 'volMyt1',
        },
      ],
      tracks: [
        {
          id: 'foo',
          type: 'BasicTrack',
          height: 20,
          configuration: 'testConfig',
          displays: [
            {
              type: 'LinearBareDisplay',
              configuration: 'testConfig-LinearBareDisplay',
            },
          ],
        },
      ],
    },
  ],
}
const assemblyConf = {
  name: 'volMyt1',
  sequence: {
    trackId: 'sequenceConfigId',
    type: 'ReferenceSequenceTrack',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 30000000,
          seq: 'cattgttgcg',
        },
        {
          refName: 'ctgB',
          uniqueId: 'secondId',
          start: 8,
          end: 10,
          seq: 'cattgttgcgatt',
        },
      ],
    },
  },
}

describe('model testing linear genome multilevel view', () => {
  console.warn = jest.fn()
  it('toggles controls', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearView', mv)
    // @ts-ignore
    session.views[0].setWidth(800)
    // @ts-ignore
    const view = session.views[0].views[1]
    view.toggleControls()
    expect(view.hideControls).toBe(false)
  })
  it('toggles visibility', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearView', mv)
    // @ts-ignore
    session.views[0].setWidth(800)
    // @ts-ignore
    const view = session.views[0].views[1]
    view.toggleVisible()
    expect(view.isVisible).toBe(false)
  })
  it('toggles anchor', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearView', mv)
    // @ts-ignore
    session.views[0].setWidth(800)
    // @ts-ignore
    const view = session.views[0].views[2]
    view.toggleIsAnchor()
    expect(view.isAnchor).toBe(false)
  })
  it('toggles overview', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearView', mv)
    // @ts-ignore
    session.views[0].setWidth(800)
    // @ts-ignore
    const view = session.views[0].views[0]
    view.toggleIsOverview()
    expect(view.isOverview).toBe(false)
  })
})
