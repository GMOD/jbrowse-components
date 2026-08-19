import { createTestEnvironment } from './testEnv.ts'

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
