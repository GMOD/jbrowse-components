import { DisplayUIProvider, plainChromeOverlays } from '@jbrowse/display-ui'
import { render } from '@testing-library/react'

import DisplayChrome from './DisplayChrome.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'
import TrackControl from './trackControl/TrackControl.tsx'

import type { DisplayChromeOverlays } from '@jbrowse/display-ui'
import type { ReactNode } from 'react'

// One provider over the two seams, driven off the shared chrome fixture.
//
// The claim under test is not "it renders" — the build-your-own site's smoke
// census already proves that in a real browser. It is the pair of invariants
// the design rests on, both of which are the kind that break silently:
//
//   - mounting it supplies BOTH contexts. Wiring one and forgetting the other
//     gives plain scrims with Material corner buttons, which looks like a
//     styling bug rather than a missing provider.
//   - NOT mounting it changes nothing. The contexts deliberately default to
//     undefined so a display rendering outside any provider — a unit test, the
//     SVG export, breakpoint-split-view's overlayUtils — keeps JBrowse's own
//     Material look. If someone ever "simplifies" those defaults to the plain
//     sets, every one of those paths degrades with nothing to show for it.

// The same fingerprint the site's smoke census uses: an outermost Mui* class.
function muiElements(container: HTMLElement) {
  return [...container.querySelectorAll('[class*="Mui"]')].filter(
    el => !el.parentElement?.closest('[class*="Mui"]'),
  )
}

// a display holding an error, plus a corner control — one consumer of each
// context, which is what makes "both or neither" observable
function Subject() {
  const model = TestChromeModel.create({})
  model.setError(new Error('boom'))
  return (
    <>
      <DisplayChrome model={model} factory={stubFactory} testid="probe">
        {({ canvasRef }) => <canvas ref={canvasRef} />}
      </DisplayChrome>
      <TrackControl icon="height" tooltip="Track sizing" onClick={() => {}} />
    </>
  )
}

function renderIn(wrap: (children: ReactNode) => ReactNode) {
  return render(<>{wrap(<Subject />)}</>)
}

test('mounting it supplies both seams, with no argument', async () => {
  const { container, findByTestId } = renderIn(children => (
    <DisplayUIProvider>{children}</DisplayUIProvider>
  ))

  // the plain error bar, by the testid four test systems key on
  await findByTestId('reload_button')
  expect(muiElements(container)).toHaveLength(0)
})

test('not mounting it leaves JBrowse its own Material look', async () => {
  const { container, findByTestId } = renderIn(children => children)

  await findByTestId('reload_button')
  // both halves are Material: the error bar and the corner control. The exact
  // count is not the point — that it is nonzero is, because zero here would
  // mean the contexts had acquired a plain ambient default.
  expect(muiElements(container).length).toBeGreaterThan(0)
})

test('overlays can be replaced without giving up the plain corner control', async () => {
  const MyErrorBar = function MyErrorBar({ visible }: { visible: boolean }) {
    return visible ? <div data-testid="my-error-bar" /> : null
  }
  const mine: DisplayChromeOverlays = {
    ...plainChromeOverlays,
    ErrorBar: MyErrorBar,
  }
  const { container, findByTestId, queryByTestId } = renderIn(children => (
    <DisplayUIProvider overlays={mine}>{children}</DisplayUIProvider>
  ))

  await findByTestId('my-error-bar')
  expect(queryByTestId('reload_button')).toBeNull()
  // trackControl was not supplied, so it is still the plain default rather than
  // falling back to Material
  expect(muiElements(container)).toHaveLength(0)
})
