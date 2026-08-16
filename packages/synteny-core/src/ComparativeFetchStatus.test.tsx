import { DisplayUIProvider } from '@jbrowse/display-ui'
import { render } from '@testing-library/react'

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

const loading: ComparativeStatusModel = {
  loading: true,
  refetching: false,
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
// those handlers, and this caller passes neither. So the Material path scores
// zero on the census that was supposed to be watching it.
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
    { loading: false, refetching: true, statusMessage: 'Refetching' },
  )

  await findByTestId('progress-chip')
  expect(queryByTestId('loading-overlay')).toBeNull()
})

test('an idle display draws neither', () => {
  const { container } = renderIn(
    children => <DisplayUIProvider>{children}</DisplayUIProvider>,
    { loading: false, refetching: false },
  )

  expect(container.innerHTML).toBe('')
})
