import { waitFor } from '@testing-library/react'

import '@testing-library/jest-dom/extend-expect'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import 'requestidlecallback-polyfill'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})
const mv = {
  id: 'MiDMyyWpxp',
  // @ts-ignore
  type: 'MultilevelLinearComparativeView',
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
          assemblyNames: ['volMyt1'],
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
          assemblyNames: ['volMyt1'],
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
          assemblyNames: ['volMyt1'],
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

describe('model testing multilevellinearcomparative view', () => {
  console.warn = jest.fn()
  it('sets limit bp per px for all views', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearComparativeView', mv)
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    model.setLimitBpPerPx()

    expect(model.views[0].limitBpPerPx).toStrictEqual({
      limited: true,
      upperLimit: 100000,
      lowerLimit: 100000,
    })
    expect(model.views[2].limitBpPerPx).toStrictEqual({
      limited: false,
      upperLimit: 1,
      lowerLimit: 1,
    })
  })
  it('toggles linked views', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearComparativeView', mv)
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    model.toggleLinkViews()
    expect(model.linkViews).toBe(false)
  })
  it('aligns views', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearComparativeView', mv)
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    await waitFor(() => {}, { timeout: 1000 })
    model.alignViews()
    expect(model.views[1].bpPerPx).toBe(100)
  })
  it('sub view action horiz scrolls', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearComparativeView', mv)
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    await waitFor(() => {}, { timeout: 1000 })
    model.onSubviewAction('horiontalScroll', '/views/2', [-1])
    expect(model.views[1].coarseTotalBp).toBe(0)
  })
  it('sub view action zooms', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearComparativeView', mv)
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    model.onSubviewAction('zoomTo', '/views/2', [2])
    expect(model.views[1].bpPerPx).toBe(100)
  })
  it('sub view action navs', async () => {
    const session = createTestSession()
    // @ts-ignore
    session.addAssemblyConf(assemblyConf)
    // @ts-ignore
    session.addView('MultilevelLinearComparativeView', mv)
    // @ts-ignore
    const model = session.views[0]
    model.setWidth(800)
    await waitFor(() => {}, { timeout: 1000 })
    model.onSubviewAction('navToLocString', '/views/2', ['ctgA', 'volMyt1'])
    await waitFor(
      () => {
        expect(model.views[1].coarseDynamicBlocks[0].refName).toBe('ctgA')
      },
      { timeout: 1000 },
    )
  })
})
