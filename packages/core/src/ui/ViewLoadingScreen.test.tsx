import { act, render } from '@testing-library/react'

import ViewLoadingScreen from './ViewLoadingScreen.tsx'

// The point of this screen is to answer "is the app hung, or is it downloading
// something?" — so what's pinned here is that the phase label reaches the DOM,
// and that a determinate status draws an actual bar rather than silently
// degrading to the same animated ellipses an indeterminate one shows.

test('shows the phase label, with the percent when determinate', () => {
  const { container } = render(
    <ViewLoadingScreen
      message="Downloading chromosome aliases"
      fraction={0.42}
    />,
  )
  expect(container.textContent).toContain('Downloading chromosome aliases 42%')

  const bar = container.querySelector('[role="progressbar"]')
  expect(bar).not.toBeNull()
  // determinate: MUI reports the filled fraction, which is what distinguishes
  // this from the indeterminate case below
  expect(bar!.getAttribute('aria-valuenow')).toBe('42')
})

test('an indeterminate phase keeps the label and drops the bar', () => {
  const { container } = render(
    <ViewLoadingScreen message="Downloading chromosome sizes" />,
  )
  expect(container.textContent).toContain('Downloading chromosome sizes')
  expect(container.textContent).not.toContain('%')
  expect(container.querySelector('[role="progressbar"]')).toBeNull()
})

test('falls back to a bare Loading when nothing has reported yet', () => {
  const { container } = render(<ViewLoadingScreen />)
  expect(container.textContent).toContain('Loading')
})

// The stalled notice is the whole reason the phase carries a URL: "Downloading
// chromosome aliases" describes a hosted hub that has stopped answering exactly
// as well as it describes a healthy load, and only the address separates them.
describe('the stalled-load notice', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('says nothing until the load has actually stopped reporting', () => {
    const { container } = render(
      <ViewLoadingScreen
        message="Downloading chromosome aliases"
        source="https://hgdownload.soe.ucsc.edu/hg38.chromAlias.txt"
      />,
    )
    expect(container.textContent).not.toContain('still waiting')

    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(container.textContent).toContain(
      'still waiting on https://hgdownload.soe.ucsc.edu/hg38.chromAlias.txt',
    )
  })

  // a download that is merely slow reports the whole way through it, and must
  // never accuse the server of anything
  it('restarts its wait on every status, bytes included', () => {
    const { container, rerender } = render(
      <ViewLoadingScreen
        message="Downloading cytobands"
        fraction={0.1}
        source="https://example.com/cytoband.txt.gz"
      />,
    )
    for (const fraction of [0.2, 0.3, 0.4]) {
      act(() => {
        jest.advanceTimersByTime(4000)
      })
      rerender(
        <ViewLoadingScreen
          message="Downloading cytobands"
          fraction={fraction}
          source="https://example.com/cytoband.txt.gz"
        />,
      )
    }
    act(() => {
      jest.advanceTimersByTime(4000)
    })
    expect(container.textContent).not.toContain('still waiting')
  })

  it('takes the notice back down when the load speaks again', () => {
    const { container, rerender } = render(
      <ViewLoadingScreen
        message="Downloading chromosome sizes"
        source="https://example.com/hg38.fa.fai"
      />,
    )
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(container.textContent).toContain('still waiting')

    rerender(
      <ViewLoadingScreen
        message="Downloading cytobands"
        source="https://example.com/cytoband.txt.gz"
      />,
    )
    expect(container.textContent).not.toContain('still waiting')
  })

  // a Blob or a FileHandle has no address to go and check, and a notice naming
  // nothing is worse than none
  it('stays silent for a location with no address', () => {
    const { container } = render(
      <ViewLoadingScreen message="Downloading chromosome sizes" />,
    )
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(container.textContent).not.toContain('still waiting')
  })
})
