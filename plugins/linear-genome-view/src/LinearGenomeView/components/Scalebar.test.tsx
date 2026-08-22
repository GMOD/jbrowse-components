import {
  createTestSession,
  createTestSessionAsync,
} from '@jbrowse/web/testUtils'
import { render, waitFor } from '@testing-library/react'

import Scalebar from './Scalebar.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// a LinearGenomeView nested in a LinearSyntenyView, which opts its sub-views
// into the assembly-name scalebar prefix via showAssemblyNameInSubviewScalebar.
// bpPerPx 0.25 draws each 100bp region 400px wide, wide enough that the folded
// "volvox:ctgA" label fits inside the region it names
async function syntenySubView(offsetPx: number, bpPerPx = 0.25) {
  const session = (await createTestSessionAsync({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              type: 'LinearGenomeView',
              offsetPx,
              bpPerPx,
              displayedRegions: [
                { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
                { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 100 },
              ],
              tracks: [],
              configuration: {},
            },
          ],
          tracks: [],
        },
      ],
    },
  })) as any
  const model = session.views[0].views[0]
  model.setWidth(800)
  return model
}

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
    const model = await syntenySubView(0)

    const { getByTestId, queryByTestId, container } = render(
      <Scalebar model={model} />,
    )
    await waitFor(() => {
      const labelA = getByTestId('refLabel-ctgA')
      const labelB = getByTestId('refLabel-ctgB')
      // Only leftmost label should have the prefix
      expect(labelA.textContent).toBe('volvox:ctgA')
      expect(labelB.textContent).toBe('ctgB')
      // Verify only one instance of the prefix exists
      expect(container.textContent.match(/volvox:/g)?.length).toBe(1)
      // The sticky label carries the prefix, so the standalone bare-assembly
      // prefix must not also render (would show "volvox" twice)
      expect(queryByTestId('refLabel-prefix')).toBeNull()
    })
  })

  it('displays assembly name prefix only on pinned label when scrolled', async () => {
    // scrolled so ctgA's left end is off-screen (its label pins to the viewport)
    const model = await syntenySubView(50)

    const { queryByTestId, container } = render(<Scalebar model={model} />)
    await waitFor(() => {
      // The pinned label should have the prefix, non-pinned labels should not
      // Verify only one instance of the prefix exists (on the pinned label)
      expect(container.textContent.match(/volvox:/g)?.length).toBe(1)
      // The pinned label contains volvox:ctgA
      expect(container.textContent).toContain('volvox:ctgA')
      // ctgB should appear without prefix
      expect(container.textContent).toContain('ctgB')
      expect(container.textContent).not.toContain('volvox:ctgB')
      // The sticky label carries the prefix, so the standalone bare-assembly
      // prefix must not also render
      expect(queryByTestId('refLabel-prefix')).toBeNull()
    })
  })

  it('pins the bare assembly name when the view is scrolled left of its regions', async () => {
    // negative offsetPx: the row's data starts mid-viewport, as it does for
    // every genome but the longest one in a stack of whole-genome synteny rows
    const model = await syntenySubView(-300)

    const { getByTestId, container } = render(<Scalebar model={model} />)
    await waitFor(() => {
      // ctgA's label is out at the region's left edge, 300px from the viewport
      // edge, so folding the assembly name into it would leave the left of the
      // row unlabeled while rows whose data starts at 0 are labeled
      expect(getByTestId('refLabel-ctgA').textContent).toBe('ctgA')
      expect(getByTestId('refLabel-prefix').textContent).toBe('volvox')
      expect(container.textContent).not.toContain('volvox:')
    })
  })

  it('pins the bare assembly name when the folded label would not fit', async () => {
    // ctgA drawn 100px wide, of which 50 are left after the scroll: no room for
    // "volvox:ctgA" without running over ctgB, and a name clipped mid-glyph
    // names a chromosome that does not exist
    const model = await syntenySubView(50, 1)

    const { getByTestId, queryByTestId } = render(<Scalebar model={model} />)
    await waitFor(() => {
      expect(getByTestId('refLabel-prefix').textContent).toBe('volvox')
    })
    expect(queryByTestId('refLabel-ctgA')).toBeNull()
  })

  it('does not display assembly name prefix for a top-level view', async () => {
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
