import { DisplayUIProvider } from '@jbrowse/display-ui'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import ComparativeFetchStatus from './ComparativeFetchStatus.tsx'

import type { ComparativeStatusModel } from './ComparativeFetchStatus.tsx'
import type { ReactNode } from 'react'

// The comparative displays sat behind neither bring-your-own seam, and the way
// that stayed true for so long is the part worth pinning: the build-your-own
// site's census counts Material elements once a page has settled, and this
// component only draws during a load. So an embedder who mounted
// `DisplayUIProvider` to keep Material off their page got it here anyway, on
// every first fetch, with every check green.
//
// Both directions are asserted for the reason `DisplayUIProvider.test.tsx`
// asserts both: a seam wired one way round reads as a styling bug rather than a
// missing provider.

// The buttons' wiring is on every model this component takes
// (`SyntenyFetchStateMixin` gives both displays all three members), so it is
// defaulted here and each test overrides only the one it drives.
const idle: ComparativeStatusModel = {
  loading: false,
  refetching: false,
  fetchCanceled: false,
  cancelFetchByUser: () => {},
  reload: () => {},
}

const loading: ComparativeStatusModel = {
  ...idle,
  loading: true,
  statusMessage: 'Downloading',
  statusProgress: 0.5,
}

function renderIn(wrap: (children: ReactNode) => ReactNode, display = loading) {
  return render(<>{wrap(<ComparativeFetchStatus display={display} />)}</>)
}

// **Counting `Mui*` classnames cannot tell these two apart, and that is the
// whole reason this hole survived.** Both sets render `loading-overlay`; core's
// `LoadingOverlay` styles itself with `makeStyles`, which emits an *emotion*
// class carrying no `Mui` in its name, and its only true Material elements are
// the cancel and retry `IconButton`s — which render only when a caller passes
// those handlers, and this caller passed neither. So the Material path scored
// zero on the census that was supposed to be watching it.
//
// It passes both handlers now, and the census still cannot see this: the cancel
// waits out a five-second anti-accident delay and the retry only exists over an
// already-cancelled load, so neither is on screen when a page settles or during
// the second a fetch takes.
//
// The class attribute is the discriminator instead: the plain set styles inline
// and leaves it empty, the Material one always has an emotion class. Same test
// `plainChromeOverlays.test.tsx` uses in the LGV plugin.
function overlayClass(container: HTMLElement) {
  return container.querySelector('[data-testid="loading-overlay"]')?.className
}

test('a provider reaches the comparative loading state too', async () => {
  const { container, findByTestId } = renderIn(children => (
    <DisplayUIProvider>{children}</DisplayUIProvider>
  ))

  // the plain scrim, by the testid four of JBrowse's test systems key on
  await findByTestId('loading-overlay')
  expect(overlayClass(container)).toBe('')
})

test('with no provider it keeps JBrowse its own Material look', async () => {
  const { container, findByTestId } = renderIn(children => children)

  await findByTestId('loading-overlay')
  // an empty class here would mean the context had acquired a plain ambient
  // default, which would silently restyle the SVG export and every unit test
  // that renders one of these
  expect(overlayClass(container)).not.toBe('')
})

test('a refetch draws the background chip rather than the scrim', async () => {
  // `loading` and `refetching` are different questions on
  // `SyntenyFetchStateMixin` — a refetch has drawn content underneath it, so it
  // reports through the corner rather than covering the canvas.
  const { findByTestId, queryByTestId } = renderIn(
    children => <DisplayUIProvider>{children}</DisplayUIProvider>,
    { ...idle, refetching: true, statusMessage: 'Refetching' },
  )

  await findByTestId('progress-chip')
  expect(queryByTestId('loading-overlay')).toBeNull()
})

test('an idle display draws neither', () => {
  const { container } = renderIn(
    children => <DisplayUIProvider>{children}</DisplayUIProvider>,
    idle,
  )

  expect(container.innerHTML).toBe('')
})

// The cancel and the retry, which this binding passed neither of for as long as
// it existed — so these were the only two displays in the product with no way
// to stop a slow load, while the component underneath supported both the whole
// time (ADR-054 §2 recorded it as a feature gap). Both sets get them, because
// both read the same three members off the same model.
//
// Which button each test drives is a matter of which delay it can avoid, not of
// which set is interesting: the plain set draws its Cancel the moment the
// overlay is visible, while the Material one holds it back five seconds.

test('a host set gets the cancel, wired to the model', () => {
  const cancelFetchByUser = jest.fn()
  const { getByTestId } = renderIn(
    children => <DisplayUIProvider>{children}</DisplayUIProvider>,
    { ...loading, cancelFetchByUser },
  )

  fireEvent.click(getByTestId('loading-overlay-cancel'))
  expect(cancelFetchByUser).toHaveBeenCalledTimes(1)
})

test("JBrowse's own set gets the retry, over a cancelled load", () => {
  // `fetchCanceled` is durable by design — nothing in the comparative family
  // restarts the fetch on its own, not even a viewport change — so this button
  // is the whole way back, and `loading` staying true (it is `!ready`) is what
  // keeps the overlay carrying it on screen.
  const reload = jest.fn()
  const { getByTestId, queryByTestId } = renderIn(children => children, {
    ...loading,
    fetchCanceled: true,
    reload,
  })

  expect(queryByTestId('loading-overlay-cancel')).toBeNull()
  fireEvent.click(getByTestId('loading-overlay-retry'))
  expect(reload).toHaveBeenCalledTimes(1)
})

describe("JBrowse's own set, past the anti-accident delay", () => {
  // `LoadingOverlay` offers Cancel only after the overlay has been continuously
  // visible for five seconds, so a fast load cannot be cancelled by a stray
  // click. That timer is component state, which is why this is the one test
  // here that needs fake ones.
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('the cancel appears and reaches the model', () => {
    const cancelFetchByUser = jest.fn()
    const { getByTestId, queryByTestId } = renderIn(children => children, {
      ...loading,
      cancelFetchByUser,
    })

    expect(queryByTestId('loading-overlay-cancel')).toBeNull()
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    fireEvent.click(getByTestId('loading-overlay-cancel'))
    expect(cancelFetchByUser).toHaveBeenCalledTimes(1)
  })
})
