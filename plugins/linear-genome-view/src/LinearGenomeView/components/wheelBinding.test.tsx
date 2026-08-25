import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, render, waitFor } from '@testing-library/react'

import LinearGenomeViewContainer from './LinearGenomeViewContainer.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assemblyConf = {
  name: 'volMyt1',
  sequence: {
    trackId: 'sequenceConfigId',
    type: 'ReferenceSequenceTrack',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 10_000,
          seq: 'cattgttgcg'.repeat(1000),
        },
      ],
    },
  },
}

// A measured view with something on screen, and scroll-to-zoom on — the mode
// this is about, because it is the one where a plain wheel means "zoom" and the
// page therefore has to keep some surface of its own.
async function scrollZoomView() {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.setScrollZoom(true)
  session.addView('LinearGenomeView', {
    id: 'lgv',
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volMyt1' },
    ],
  })
  const model = session.views[0] as LinearGenomeViewModel
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  expect(model.scrollZoom).toBe(true)

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeViewContainer model={model} />
    </ThemeProvider>,
  )
  return { model, container }
}

// Non-passive, on the element itself, and dispatched natively — React registers
// `wheel` at the root as a PASSIVE listener, so a synthetic event through
// `fireEvent` would report `defaultPrevented: false` whatever the handler did.
// `cancelable` is what makes preventDefault mean anything, and the return value
// is whether the page keeps the gesture.
function wheelOver(element: Element, deltaY = 120) {
  let pageKeptIt = true
  act(() => {
    const event = new WheelEvent('wheel', {
      deltaY,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(event)
    pageKeptIt = !event.defaultPrevented
  })
  return pageKeptIt
}

// The zoom is accumulated in the handler and applied in one requestAnimationFrame.
async function settleFrame() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 60))
  })
}

// The tracks area is inside the element the wheel is bound to (`tracksRef`);
// the header sits outside it. The header target is the scroll-to-zoom toggle,
// which is a leaf of the header row — so what reaches a listener from it
// reaches it by bubbling, which is the whole question. It is also the control
// `browser-tests/probe-scroll-gutter.ts` drives.
function parts(container: HTMLElement) {
  const tracks = container.querySelector('[data-testid="tracksContainer"]')!
  const header = container.querySelector('button[value="scrollZoom"]')!
  return { tracks, header }
}

test('a wheel over the tracks zooms the view and the page does not get it', async () => {
  const { model, container } = await scrollZoomView()
  const { tracks } = parts(container)
  const before = model.bpPerPx

  const pageKeptIt = wheelOver(tracks)
  await settleFrame()

  expect(pageKeptIt).toBe(false)
  expect(model.bpPerPx).toBeGreaterThan(before)
})

// The whole point of binding below the header rather than to the view.
//
// With scroll-to-zoom on there is no modifier left to scroll a page with:
// browsers turn shift+wheel into HORIZONTAL scroll, ctrl/meta+wheel is how a
// trackpad reports a pinch, and Firefox binds alt+wheel to history navigation.
// So the way out is spatial, and the view's sticky chrome is the surface — a
// band that is always on screen and the full width of the window. Bound to the
// view instead, that band is gone too and 30 wheel notches move a page with
// 581px below the fold by 0px, which is what this measures without a layout:
// the listener is on `tracksRef`, so a wheel on the header never reaches it and
// the browser's own scrolling is left alone.
test('a wheel over the view header is left to the page', async () => {
  const { model, container } = await scrollZoomView()
  const { header } = parts(container)
  const before = model.bpPerPx

  const pageKeptIt = wheelOver(header)
  await settleFrame()

  expect(pageKeptIt).toBe(true)
  expect(model.bpPerPx).toBe(before)
})

// ...and the header is really inside the view, so what leaves the gesture alone
// is the binding and not an element that happens to sit somewhere else in the
// document.
test('the header the page keeps is a descendant of the view', async () => {
  const { container } = await scrollZoomView()
  const { header, tracks } = parts(container)

  expect(container.firstElementChild!.contains(header)).toBe(true)
  expect(tracks.contains(header)).toBe(false)
})

// ctrl+wheel is a trackpad pinch, and it zooms whatever the preference says —
// so the spatial rule has to hold for it too, or the gutter scrolls in one mode
// and zooms in the other.
test('a pinch over the header is left to the page as well', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', {
    id: 'lgv',
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volMyt1' },
    ],
  })
  const model = session.views[0] as LinearGenomeViewModel
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  expect(model.scrollZoom).toBe(false)

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeViewContainer model={model} />
    </ThemeProvider>,
  )
  const { header, tracks } = parts(container)
  const pinch = (element: Element) => {
    let prevented = false
    act(() => {
      const event = new WheelEvent('wheel', {
        deltaY: 120,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(event)
      prevented = event.defaultPrevented
    })
    return prevented
  }

  expect(pinch(header)).toBe(false)
  const before = model.bpPerPx
  await settleFrame()
  expect(model.bpPerPx).toBe(before)

  // the same gesture over the tracks is the view's
  expect(pinch(tracks)).toBe(true)
  await settleFrame()
  expect(model.bpPerPx).toBeGreaterThan(before)
})
