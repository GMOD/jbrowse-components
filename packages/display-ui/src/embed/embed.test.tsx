import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { Legend, Track, TrackStack, TrackToggle } from './index.tsx'

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
  expect(screen.getByRole('status').textContent).toBe('Loading hg38')

  act(() => {
    view.setStatus({ type: 'ready' })
  })

  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByTestId('drawn-genes')).toBeTruthy()
  expect(screen.getByTestId('drawn-reads')).toBeTruthy()
  const slots = container.querySelectorAll('[data-track-overlay-slot]')
  expect(slots).toHaveLength(2)
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

test('a legend lists the rows of the key a display derived, and nothing for an empty key', () => {
  const { rerender } = render(
    <Legend
      display={{
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
      }}
    />,
  )
  const legend = screen.getByTestId('embed-legend')
  expect(legend.textContent).toBe('strandforwardreverse')
  expect(legend.querySelectorAll('rect')).toHaveLength(2)
  expect(screen.getByText('reverse').style.textDecoration).toBe('line-through')

  rerender(<Legend display={{ legendSpec: { sections: [] } }} />)
  expect(screen.queryByTestId('embed-legend')).toBeNull()
})
