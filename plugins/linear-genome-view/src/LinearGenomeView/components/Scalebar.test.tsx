import {
  createTestSession,
  createTestSessionAsync,
} from '@jbrowse/web/testUtils'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import Scalebar from './Scalebar.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// a LinearGenomeView nested in a LinearSyntenyView, which opts its sub-views
// into the assembly-name scalebar prefix via showAssemblyNameInSubviewScalebar.
// bpPerPx 0.25 draws each 100bp region 400px wide
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

  // 0: ctgA starts under the caption. 50: ctgA's left end is off screen.
  // -300: the row's data starts mid-viewport, as it does for every genome but
  // the longest in a stack of whole-genome synteny rows
  it.each([0, 50, -300])(
    'captions the row with its assembly name and leaves the refNames bare, at offsetPx %d',
    async offsetPx => {
      const model = await syntenySubView(offsetPx)

      const { getByTestId } = render(<Scalebar model={model} />)
      await waitFor(() => {
        expect(getByTestId('refLabel-prefix').textContent).toBe('volvox')
        expect(getByTestId('refLabel-ctgA').textContent).toBe('ctgA')
        expect(getByTestId('refLabel-ctgB').textContent).toBe('ctgB')
      })
    },
  )

  it('drops a refName with no room left after the caption', async () => {
    // ctgA drawn 100px wide, of which 50 are left after the scroll and ~37 of
    // those are under the caption
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
  // The pinned chromosome name is drawn on an opaque backing, over a run whose
  // own left edge is off screen — so `runRefNameLabelPx`, which keeps the
  // numbers out from under a name at its run's left edge, has reserved nothing
  // there. The number underneath came out with its leading digits painted over,
  // and ",000" reads as a coordinate, just not the right one.
  it('hides the coordinate number the pinned refName label would paint over', async () => {
    const session = createTestSession({
      sessionSnapshot: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 10,
            displayedRegions: [
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 0,
                end: 100_000,
              },
            ],
            tracks: [],
          },
        ],
      },
    }) as any
    const model = session.views[0]
    model.setWidth(800)
    // "ctgA" occupies screen [0, 23.1]; "22,000" is centered at 18.9, spanning
    // [0.1, 37.7], so all but its last three digits sit under the name
    model.scrollTo(2180)

    const { getByText } = render(<Scalebar model={model} />)
    await waitFor(() => {
      expect(getByText('22,000').parentElement!.style.visibility).toBe('hidden')
    })
    // the next number along is 200px clear of the name and still drawn
    expect(getByText('24,000').parentElement!.style.visibility).toBe('')
  })
  // horizontallyFlip reverses the order and flips every region at once, so a
  // flipped row is uniformly reversed and the marker is a fact about the ROW —
  // said once, in the row's own caption, on no chromosome name. A marker on a
  // name is how the mixed case says that one region is flipped, and the two
  // must not render alike. On screen the search box already says [rev]; a
  // synteny row hides its header and an exported figure has no search box.
  it('captions a horizontally flipped row once, on no chromosome name', async () => {
    const session = createTestSession({
      sessionSnapshot: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 1,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 400 },
              { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 400 },
            ],
            tracks: [],
          },
        ],
      },
    }) as any
    const model = session.views[0]
    model.setWidth(800)

    const { getByTestId, queryByTestId, rerender } = render(
      <Scalebar model={model} />,
    )
    await waitFor(() => {
      expect(getByTestId('refLabel-ctgA').textContent).toBe('ctgA')
    })
    expect(queryByTestId('refLabel-prefix')).toBeNull()

    model.horizontallyFlip()
    rerender(<Scalebar model={model} />)
    await waitFor(() => {
      expect(getByTestId('refLabel-prefix').textContent).toBe('[rev]')
    })
    // neither name wears it, so neither reads as the flipped one of the two
    expect(getByTestId('refLabel-ctgA').textContent).toBe('ctgA')
    expect(getByTestId('refLabel-ctgB').textContent).toBe('ctgB')
  })

  // The collapsed-introns shape: several windows cut out of one contig, drawn
  // under a single label. Rejoining them is the only way back to the gene's
  // whole span once the "Introns collapsed" snackbar is gone. Zoomed in on
  // purpose: the label's own bracket comes off the static blocks, which stop at
  // the viewport, so the span has to be taken from the region list instead.
  it('rejoins a run of regions into the span they were cut from', async () => {
    const session = createTestSession({
      sessionSnapshot: {
        views: [
          {
            type: 'LinearGenomeView',
            offsetPx: 0,
            bpPerPx: 10,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 5000 },
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 10000,
                end: 15000,
              },
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 20000,
                end: 25000,
              },
              {
                assemblyName: 'volvox',
                refName: 'ctgA',
                start: 30000,
                end: 35000,
              },
            ],
            tracks: [],
          },
        ],
      },
    }) as any
    const model = session.views[0]
    model.setWidth(800)
    render(<Scalebar model={model} />)

    fireEvent.click(await screen.findByTestId('refLabel-ctgA'))
    fireEvent.click(await screen.findByText('Show the whole span of ctgA'))

    await waitFor(() => {
      expect(model.displayedRegions).toHaveLength(1)
    })
    expect(model.displayedRegions[0].refName).toBe('ctgA')
    expect(model.displayedRegions[0].start).toBe(0)
    expect(model.displayedRegions[0].end).toBe(35000)
    // and the view is looking at it, not left at the old offsetPx in a
    // coordinate space the rejoin just redefined
    expect(model.offsetPx).toBe(0)
  })
})
