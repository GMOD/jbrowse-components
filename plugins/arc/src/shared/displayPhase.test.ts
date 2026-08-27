import { createTestEnvironment } from './testEnv.ts'

import type { Region } from '@jbrowse/core/util'

// Arc has no rendering backend, so its phase is the `Status` variant — every
// phase except `renderError`. These pin that it is otherwise the same state
// machine every GPU display runs, because arc's chrome is now literally the
// same component (`DisplayStatusChrome`) and a phase it gets wrong shows up as
// the wrong banner rather than as a type error.
describe('arc displayPhase', () => {
  // the harness installs the fetch autoruns asynchronously, so a display read
  // synchronously after creation has nothing in flight — which is what makes
  // the cancel case below a real transition rather than a no-op
  it('is ready with no fetch in flight', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.displayPhase).toBe('ready')
  })

  it('ranks tooLarge above loading', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.displayPhase).toBe('tooLarge')
  })

  // The regression this file was added for. `cancelFetchByUser` drops the stop
  // token synchronously, so `isLoading` goes false the instant the user clicks
  // Cancel — and the overlay that unmounts on it is the one carrying Retry.
  // Nothing else restarts an arc fetch (`prepare` reads `dataCurrent`, which
  // a cancel doesn't move), so a `ready` phase here means a stopped, empty
  // display offering the user no way back. Every other family already spelled
  // `fetchCanceled` into its loading term; arc read a bare `isLoading`.
  it('stays loading after a user cancel, so the retry affordance survives', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.cancelFetchByUser()

    expect(display.isLoading).toBe(false)
    expect(display.fetchCanceled).toBe(true)
    expect(display.displayPhase).toBe('loading')
  })

  it('leaves the canceled state once a fetch starts again', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.cancelFetchByUser()
    display.reload()

    expect(display.fetchCanceled).toBe(false)
  })
})

// A scaffold-level assembly, the one way into `viewportEmpty`: 400 regions of
// 100bp each elide under `minimumBlockWidth` once the whole set is on screen,
// so the view holds no content block.
const SCAFFOLDS: Region[] = Array.from({ length: 400 }, (_, i) => ({
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: i * 1000,
  end: i * 1000 + 100,
}))

function offContentDisplay() {
  const { view, display } = createTestEnvironment().createDisplay({
    displayedRegions: SCAFFOLDS,
  })
  view.zoomTo(50)
  return { view, display }
}

// `painted` feeds `data-display-drawn`, which the screenshot and browser
// harnesses wait on. Nothing ever fetches on an empty viewport, so a `painted`
// reading only `features`/`error` leaves the attribute at "false" for the life
// of the display and `waitForDisplaysDone` burns its timeout in silence.
describe('arc painted', () => {
  it('reports finished on a viewport holding no content', () => {
    const { view, display } = offContentDisplay()
    expect(view.hasVisibleContent).toBe(false)
    expect(display.features).toBeUndefined()
    expect(display.error).toBeUndefined()
    expect(display.painted).toBe(true)
  })

  it('waits for data on a viewport that does hold content', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.viewportEmpty).toBe(false)
    expect(display.painted).toBe(false)
  })
})
