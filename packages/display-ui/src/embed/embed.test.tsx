import { types } from '@jbrowse/mobx-state-tree'
import { act, render, screen } from '@testing-library/react'

import { TrackStack } from './index.tsx'

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

test('an error is an alert naming what failed', () => {
  const view = fakeView({ type: 'error', error: new Error('no such genome') })
  render(<TrackStack view={view} />)
  expect(screen.getByRole('alert').textContent).toBe(
    'Could not load: no such genome',
  )
})
