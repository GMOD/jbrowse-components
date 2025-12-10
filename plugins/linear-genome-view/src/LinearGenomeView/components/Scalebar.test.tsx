import { createTestSession } from '@jbrowse/web/src/rootModel'
import { render, waitFor } from '@testing-library/react'

import Scalebar from './Scalebar'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

describe('Scalebar genome view component', () => {
  it('renders two regions', async () => {
    const session = createTestSession({
      sessionSnapshot: {
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
                start: 100,
                end: 200,
              },
            ],
            tracks: [],
            configuration: {},
          },
        ],
      },
    }) as any
    session.addAssemblyConf({
      name: 'volMyt1',
      sequence: {
        trackId: 'ref0',
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'FromConfigSequenceAdapter',
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
    })
    const model = session.views[0]
    const { getByTestId } = render(<Scalebar model={model} />)
    await waitFor(() => {
      expect(getByTestId('refLabel-ctgA')).toBeTruthy()
      expect(getByTestId('refLabel-ctgB')).toBeTruthy()
    })
  })

  it('renders two regions when scrolled to the left, the label is ctgA to the actual blocks', () => {
    const session = createTestSession({
      sessionSnapshot: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: -100,
            bpPerPx: 1,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
              { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 1 },
              { assemblyName: 'volvox', refName: 'ctgC', start: 0, end: 1 },
              { assemblyName: 'volvox', refName: 'ctgD', start: 0, end: 1 },
            ],
            tracks: [],
            configuration: {},
          },
        ],
      },
    }) as any
    session.addAssemblyConf({
      name: 'volMyt1',
      sequence: {
        trackId: 'ref0',
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'FromConfigSequenceAdapter',
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
    })
    const model = session.views[0]
    const { queryByTestId } = render(<Scalebar model={model} />)
    const ret2 = queryByTestId('refLabel-ctgB')
    const ret3 = queryByTestId('refLabel-ctgC')
    const ret4 = queryByTestId('refLabel-ctgD')
    expect(ret2).toBe(null)
    expect(ret3).toBe(null)
    expect(ret4).toBe(null)
  })

  it('displays assembly name prefix only on the leftmost label when no pinned block', async () => {
    const session = createTestSession({
      sessionSnapshot: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 1,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
              { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 100 },
            ],
            tracks: [],
            configuration: {},
          },
        ],
      },
    }) as any
    const model = session.views[0]

    // Mock scalebarDisplayPrefix to simulate being in a synteny view
    const originalScaleBarDisplayPrefix = model.scalebarDisplayPrefix
    model.scalebarDisplayPrefix = () => 'volvox'

    const { getByTestId, container } = render(<Scalebar model={model} />)
    await waitFor(() => {
      const labelA = getByTestId('refLabel-ctgA')
      const labelB = getByTestId('refLabel-ctgB')
      // Only leftmost label should have the prefix
      expect(labelA.textContent).toBe('volvox:ctgA')
      expect(labelB.textContent).toBe('ctgB')
      // Verify only one instance of the prefix exists
      expect(container.textContent.match(/volvox:/g)?.length).toBe(1)
    })

    // Restore original function
    model.scalebarDisplayPrefix = originalScaleBarDisplayPrefix
  })

  it('displays assembly name prefix only on pinned label when scrolled', async () => {
    const session = createTestSession({
      sessionSnapshot: {
        views: [
          {
            type: 'LinearGenomeView',
            // Scrolled so ctgA is off-screen left (pinned)
            offsetPx: 50,
            bpPerPx: 1,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
              { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 100 },
            ],
            tracks: [],
            configuration: {},
          },
        ],
      },
    }) as any
    const model = session.views[0]

    // Mock scalebarDisplayPrefix to simulate being in a synteny view
    const originalScaleBarDisplayPrefix = model.scalebarDisplayPrefix
    model.scalebarDisplayPrefix = () => 'volvox'

    const { container } = render(<Scalebar model={model} />)
    await waitFor(() => {
      // The pinned label should have the prefix, non-pinned labels should not
      // Verify only one instance of the prefix exists (on the pinned label)
      expect(container.textContent.match(/volvox:/g)?.length).toBe(1)
      // The pinned label contains volvox:ctgA
      expect(container.textContent).toContain('volvox:ctgA')
      // ctgB should appear without prefix
      expect(container.textContent).toContain('ctgB')
      expect(container.textContent).not.toContain('volvox:ctgB')
    })

    // Restore original function
    model.scalebarDisplayPrefix = originalScaleBarDisplayPrefix
  })

  it('does not display assembly name prefix when scalebarDisplayPrefix returns empty string', async () => {
    const session = createTestSession({
      sessionSnapshot: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 1,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
            ],
            tracks: [],
            configuration: {},
          },
        ],
      },
    }) as any
    const model = session.views[0]

    const { getByTestId } = render(<Scalebar model={model} />)
    await waitFor(() => {
      const labelA = getByTestId('refLabel-ctgA')
      expect(labelA.textContent).toBe('ctgA')
    })
  })
})
