import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import {
  Legend,
  ResizeHandle,
  Track,
  TrackStack,
  TrackToggle,
} from './index.tsx'

import type { EmbedDisplay } from './index.tsx'
import type { ViewStatus } from '@jbrowse/core/util/viewStatus'

function display(name: string): EmbedDisplay {
  return {
    height: 40,
    RenderingComponent: () => <span data-testid={`drawn-${name}`} />,
  }
}

const displays: Record<string, EmbedDisplay> = {
  genes: display('genes'),
  reads: display('reads'),
}

const FakeView = types
  .model({ bpPerPx: 1 })
  .volatile(() => ({
    status: { type: 'ready' } as ViewStatus,
    tracks: [
      { configuration: { trackId: 'genes' } },
      { configuration: { trackId: 'reads' } },
    ],
  }))
  .views(() => ({
    getTrack(trackId: string) {
      const activeDisplay = displays[trackId]
      return activeDisplay ? { activeDisplay } : undefined
    },
  }))
  .actions(self => ({
    setStatus(status: ViewStatus) {
      self.status = status
    },
    setWidth() {},
    horizontalScroll(distance: number) {
      return distance
    },
    zoomTo(bpPerPx: number) {
      return bpPerPx
    },
  }))

function fakeView(status: ViewStatus) {
  const view = FakeView.create()
  view.setStatus(status)
  return view
}

test('a stack shows the view status until the view is ready, then every track in a slot', () => {
  const view = fakeView({
    type: 'loading',
    message: 'Loading hg38',
    progress: 0,
  })
  const { container } = render(<TrackStack view={view} />)
  expect(screen.getByRole('status').textContent).toBe('Loading')

  act(() => {
    view.setStatus({ type: 'ready' })
  })

  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByTestId('drawn-genes')).toBeTruthy()
  expect(screen.getByTestId('drawn-reads')).toBeTruthy()
  const slots = container.querySelectorAll('[data-track-overlay-slot]')
  expect(slots).toHaveLength(2)
})

test('a slow load shows its phase and fraction, and names the file it waits on once it stalls', () => {
  jest.useFakeTimers()
  try {
    const view = fakeView({
      type: 'loading',
      message: 'Downloading hg38.fa.gz.fai',
      progress: 0.4,
      source: 'https://example.com/hg38.fa.gz.fai',
    })
    render(<TrackStack view={view} />)
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Loading')
    expect(status.querySelector('progress')).toBeNull()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(status.textContent).toBe('Downloading hg38.fa.gz.fai')
    expect(status.querySelector('progress')?.value).toBe(0.4)

    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(status.textContent).toContain(
      'still waiting on https://example.com/hg38.fa.gz.fai',
    )

    act(() => {
      view.setStatus({
        type: 'loading',
        message: 'Downloading hg38.fa.gz.fai',
        progress: 0.5,
        source: 'https://example.com/hg38.fa.gz.fai',
      })
    })
    expect(status.textContent).not.toContain('still waiting')
  } finally {
    jest.useRealTimers()
  }
})

test('trackIds picks and orders the tracks a stack shows', () => {
  const view = fakeView({ type: 'ready' })
  render(<TrackStack view={view} trackIds={['reads']} />)
  expect(screen.queryByTestId('drawn-genes')).toBeNull()
  expect(screen.getByTestId('drawn-reads')).toBeTruthy()
})

test('children draw only once the view is ready, ahead of the tracks', () => {
  const view = fakeView({ type: 'noRegions' })
  const { container } = render(
    <TrackStack view={view}>
      <div data-testid="overlay" />
    </TrackStack>,
  )
  expect(screen.queryByTestId('overlay')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Nothing to show yet')

  act(() => {
    view.setStatus({ type: 'ready' })
  })

  const stack = container.firstElementChild!
  expect(stack.firstElementChild).toBe(screen.getByTestId('overlay'))
  expect(stack.children).toHaveLength(3)
})

test('an error is an alert naming what failed', () => {
  const view = fakeView({ type: 'error', error: new Error('no such genome') })
  render(<TrackStack view={view} />)
  expect(screen.getByRole('alert').textContent).toBe(
    'Could not load: no such genome',
  )
})

test('renderTrack draws each row, so a page puts its own chrome beside a track', () => {
  const view = fakeView({ type: 'ready' })
  render(
    <TrackStack
      view={view}
      renderTrack={id => (
        <>
          <Track view={view} trackId={id} />
          <div data-testid={`after-${id}`} />
        </>
      )}
    />,
  )
  expect(
    screen
      .getByTestId('drawn-genes')
      .compareDocumentPosition(screen.getByTestId('after-genes')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(screen.getByTestId('after-reads')).toBeTruthy()
})

test('a track toggle is checked while its track is shown, and asks the view to flip it', () => {
  const asked: string[] = []
  const view = {
    tracks: [{ configuration: { trackId: 'genes' } }],
    launchToggleTrack: (trackId: string) => {
      asked.push(trackId)
      return Promise.resolve(true)
    },
  }
  render(
    <>
      <TrackToggle view={view} trackId="genes">
        Genes
      </TrackToggle>
      <TrackToggle view={view} trackId="reads">
        Reads
      </TrackToggle>
    </>,
  )
  const genes = screen.getByLabelText<HTMLInputElement>('Genes')
  const reads = screen.getByLabelText<HTMLInputElement>('Reads')
  expect([genes.checked, reads.checked]).toEqual([true, false])
  fireEvent.click(reads)
  expect(asked).toEqual(['reads'])
})

test('a legend lists the rows of the key its track derived, and nothing for an empty key or a display with none', () => {
  const tracks: Record<string, { activeDisplay: unknown }> = {
    strand: {
      activeDisplay: {
        legendSpec: {
          title: 'strand',
          sections: [
            {
              id: 'strand',
              items: [
                { label: 'forward', color: 'red' },
                { label: 'reverse', color: 'blue', hidden: true },
              ],
            },
            { id: 'empty', items: [] },
          ],
        },
      },
    },
    empty: { activeDisplay: { legendSpec: { sections: [] } } },
    keyless: { activeDisplay: { height: 40 } },
  }
  const view = { getTrack: (trackId: string) => tracks[trackId] }
  const { rerender } = render(<Legend view={view} trackId="strand" />)
  const legend = screen.getByTestId('embed-legend')
  expect(legend.textContent).toBe('strandforwardreverse')
  expect(legend.querySelectorAll('rect')).toHaveLength(2)
  expect(screen.getByText('reverse').style.textDecoration).toBe('line-through')

  for (const trackId of ['empty', 'keyless', 'absent']) {
    rerender(<Legend view={view} trackId={trackId} />)
    expect(screen.queryByTestId('embed-legend')).toBeNull()
  }
})

test('a resize bar draws only under a track that has a display', () => {
  const view = {
    getTrack: (trackId: string) =>
      trackId === 'genes'
        ? {
            activeDisplay: {
              setResizing: () => {},
              resizeHeight: () => 0,
            },
          }
        : undefined,
  }
  render(
    <>
      <ResizeHandle view={view} trackId="genes" />
      <ResizeHandle view={view} trackId="reads" />
    </>,
  )
  expect(screen.getByLabelText('Resize genes')).toBeTruthy()
  expect(screen.queryByLabelText('Resize reads')).toBeNull()
})
