import { fireEvent, render } from '@testing-library/react'

import { RingStatus } from './RingStatus.tsx'

import type { RingDisplay } from './ringHost.ts'

function renderStatus(status: Record<string, unknown>) {
  const display = {
    id: 'genes',
    type: 'LinearBasicDisplay',
    height: 50,
    paintCount: 0,
    painted: false,
    renderNow() {},
    setHostHeight() {},
    configuration: { displayId: 'genes' },
    RenderingComponent: () => null,
    ...status,
  } as RingDisplay
  const model = {
    id: 'view',
    offsetRadians: 0,
    ringHost: { rings: [{ display, innerPx: 200, outerPx: 250 }] },
  }
  return render(
    <svg>
      <RingStatus model={model} />
    </svg>,
  )
}

test('a gated ring says so, and a click on it force loads', () => {
  const forceLoad = jest.fn()
  const { getByTestId } = renderStatus({
    displayPhase: 'tooLarge',
    regionTooLargeReason: 'Too many features',
    zoomCanReleaseGate: true,
    forceLoad,
  })
  const status = getByTestId('ring-status')
  expect(status.textContent).toContain(
    'Too many features (click to force load)',
  )
  fireEvent.click(status.querySelector('text')!)
  expect(forceLoad).toHaveBeenCalledTimes(1)
})

test('a failed ring shows its error and retries on a click', () => {
  const reload = jest.fn()
  const { getByTestId } = renderStatus({
    displayPhase: 'error',
    error: new Error('404 Not Found'),
    reload,
  })
  const status = getByTestId('ring-status')
  expect(status.textContent).toContain('404 Not Found')
  fireEvent.click(status.querySelector('text')!)
  expect(reload).toHaveBeenCalledTimes(1)
})

test('a ring showing its data draws no status', () => {
  const { queryByTestId } = renderStatus({ displayPhase: 'ready' })
  expect(queryByTestId('ring-status')).toBeNull()
})
