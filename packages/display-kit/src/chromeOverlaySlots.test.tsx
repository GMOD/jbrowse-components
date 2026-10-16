import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, screen } from '@testing-library/react'
import { observer } from 'mobx-react'

import { ErrorBarSlot, TooLargeSlot } from './chromeOverlaySlots.tsx'

import type { ErrorBarProps, TooLargeProps } from '@jbrowse/display-ui'

const RecordingErrorBar = observer(function RecordingErrorBar({
  onRetry,
}: ErrorBarProps) {
  return onRetry ? (
    <button type="button" onClick={onRetry}>
      Retry
    </button>
  ) : (
    <span>no retry</span>
  )
})

const RecordingTooLarge = observer(function RecordingTooLarge({
  message,
  onForceLoad,
}: TooLargeProps) {
  return (
    <button type="button" onClick={onForceLoad}>
      {message}
    </button>
  )
})

test('a fetch error retries through reload', () => {
  const reload = jest.fn()
  render(
    <ErrorBarSlot
      model={{ error: new Error('404'), reload }}
      ErrorBar={RecordingErrorBar}
    />,
  )
  fireEvent.click(screen.getByText('Retry'))
  expect(reload).toHaveBeenCalledTimes(1)
})

test('a byte-gate error offers every overlay set no Retry', () => {
  const error = Object.assign(new Error('Zoom in to see lanes'), {
    regionTooLarge: true,
  })
  render(
    <ErrorBarSlot
      model={{ error, reload: () => {} }}
      ErrorBar={RecordingErrorBar}
    />,
  )
  expect(screen.getByText('no retry')).toBeTruthy()
})

test('Force load reaches a plain-object model', () => {
  const forceLoad = jest.fn()
  render(
    <TooLargeSlot
      model={{
        regionTooLargeReason: 'Requested too much data',
        zoomCanReleaseGate: true,
        forceLoad,
      }}
      TooLarge={RecordingTooLarge}
    />,
  )
  fireEvent.click(screen.getByRole('button'))
  expect(forceLoad).toHaveBeenCalledTimes(1)
})

test('Force load after the track closed calls nothing', () => {
  const forceLoad = jest.fn()
  const Display = types
    .model({
      regionTooLargeReason: 'Requested too much data',
      zoomCanReleaseGate: true,
    })
    .actions(() => ({ forceLoad }))
  const parent = types
    .model({ display: types.maybe(Display) })
    .actions(self => ({
      close() {
        self.display = undefined
      },
    }))
    .create({ display: {} })
  render(<TooLargeSlot model={parent.display!} TooLarge={RecordingTooLarge} />)
  const button = screen.getByRole('button')
  parent.close()
  fireEvent.click(button)
  expect(forceLoad).not.toHaveBeenCalled()
})
