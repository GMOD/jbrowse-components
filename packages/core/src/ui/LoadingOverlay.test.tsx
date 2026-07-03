import { act, cleanup, fireEvent, render } from '@testing-library/react'

import LoadingOverlay from './LoadingOverlay.tsx'

// The overlay gates its own visibility behind a 250ms anti-flash delay and the
// cancel button behind a 5000ms anti-accident delay, both via setTimeout in
// useEffect — so these tests drive fake timers.
beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

// advance past the 250ms flash delay inside act() so the state update flushes
function flash() {
  act(() => {
    jest.advanceTimersByTime(250)
  })
}

// advance past the 5000ms cancel-enable delay
function pastCancelDelay() {
  act(() => {
    jest.advanceTimersByTime(5000)
  })
}

describe('LoadingOverlay anti-flash', () => {
  it('stays hidden during the flash delay, then appears', () => {
    const { queryByTestId } = render(<LoadingOverlay isVisible />)
    expect(queryByTestId('loading-overlay')).toBeNull()
    flash()
    expect(queryByTestId('loading-overlay')).not.toBeNull()
  })

  it('never appears when isVisible is false', () => {
    const { queryByTestId } = render(<LoadingOverlay isVisible={false} />)
    flash()
    expect(queryByTestId('loading-overlay')).toBeNull()
  })

  it('appears immediately, skipping the flash delay, when immediate is set', () => {
    const { queryByTestId } = render(<LoadingOverlay isVisible immediate />)
    expect(queryByTestId('loading-overlay')).not.toBeNull()
  })
})

describe('LoadingOverlay status + progress', () => {
  it('falls back to "Loading" when no statusMessage is given', () => {
    const { getByText } = render(<LoadingOverlay isVisible />)
    flash()
    expect(getByText('Loading')).toBeTruthy()
  })

  it('renders the determinate percentage when progress is set', () => {
    const { getByText } = render(
      <LoadingOverlay isVisible statusMessage="Downloading" progress={0.42} />,
    )
    flash()
    expect(getByText(/Downloading/)).toBeTruthy()
    expect(getByText(/42%/)).toBeTruthy()
  })

  it('shows a determinate bar filled to the progress fraction', () => {
    const { container } = render(
      <LoadingOverlay isVisible statusMessage="Downloading" progress={0.5} />,
    )
    flash()
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar!.getAttribute('aria-valuenow')).toBe('50')
  })

  it('clamps the bar to 100% when progress overshoots', () => {
    const { container } = render(
      <LoadingOverlay isVisible statusMessage="Downloading" progress={1.5} />,
    )
    flash()
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar!.getAttribute('aria-valuenow')).toBe('100')
  })

  it('renders no progress bar in the indeterminate case', () => {
    const { container } = render(
      <LoadingOverlay isVisible statusMessage="Loading features" />,
    )
    flash()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })
})

describe('LoadingOverlay cancel button', () => {
  it('is not offered until the cancel delay elapses', () => {
    const onCancel = jest.fn()
    const { queryByTestId } = render(
      <LoadingOverlay isVisible onCancel={() => onCancel()} />,
    )
    flash()
    // visible, but cancel still disabled within the first few seconds
    expect(queryByTestId('loading-overlay-cancel')).toBeNull()
    pastCancelDelay()
    expect(queryByTestId('loading-overlay-cancel')).not.toBeNull()
  })

  it('is never offered without an onCancel handler', () => {
    const { queryByTestId } = render(<LoadingOverlay isVisible />)
    flash()
    pastCancelDelay()
    expect(queryByTestId('loading-overlay-cancel')).toBeNull()
  })

  it('calls onCancel when clicked', () => {
    const onCancel = jest.fn()
    const { getByTestId } = render(
      <LoadingOverlay isVisible onCancel={() => onCancel()} />,
    )
    flash()
    pastCancelDelay()
    fireEvent.click(getByTestId('loading-overlay-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('LoadingOverlay canceled state', () => {
  it('shows the canceled message and a retry button', () => {
    const onRetry = jest.fn()
    const { getByText, getByTestId } = render(
      <LoadingOverlay isVisible canceled onRetry={() => onRetry()} />,
    )
    flash()
    expect(getByText('Loading canceled')).toBeTruthy()
    fireEvent.click(getByTestId('loading-overlay-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits the retry button when no onRetry is given', () => {
    const { getByText, queryByTestId } = render(
      <LoadingOverlay isVisible canceled />,
    )
    flash()
    expect(getByText('Loading canceled')).toBeTruthy()
    expect(queryByTestId('loading-overlay-retry')).toBeNull()
  })
})
