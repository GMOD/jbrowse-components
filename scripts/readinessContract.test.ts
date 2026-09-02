import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// "Has JBrowse finished rendering" is answered in three places, and they cannot
// share code. `@jbrowse/capture` hands its in-page functions to
// `page.evaluate`, which stringifies them, so each "can only call what it
// declares inside itself" — its own source says so three times — and it is a
// published CLI whose single runtime dependency is puppeteer, so it cannot
// import an app package without inverting the one lib→product edge
// `workspaceLayering.test.ts` allows. `reference/REJECTED_IDEAS.md` carries the
// full reasoning under "Consolidating the three implementations".
//
// What they CAN share is the contract: two attribute selectors, published by
// AppReadyMarker and LoadingOverlay and read by both. Those are plain strings
// in three files, and a rename in one of them splits the readers silently —
// each keeps waiting on a selector that is simply never going to match, which
// reads as "still loading" rather than as a broken build.
//
// So this pins the strings, not the logic. The differences BELOW the contract
// are deliberate and are not checked here: capture's pending census is the DOM
// and cannot see `tooLarge`; jb's is the session model and can. Neither is a
// bug in the other.

const root = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

const APP_READY = '[data-app-phase="ready"]'
const LOADING_OVERLAY = '[data-testid="loading-overlay"]'

describe('the readiness contract', () => {
  it('is published by AppReadyMarker, which claims it', () => {
    const marker = read('packages/app-core/src/ui/App/AppReadyMarker.tsx')
    expect(marker).toContain('data-app-phase')
    // the comment that says this component owns the contract, so a future
    // reader is not left guessing which of the three is canonical
    expect(marker).toContain(APP_READY)
  })

  it('is read by jb.waitReady with the same selectors', () => {
    const jb = read('packages/app-core/src/JbApi/jbApi.ts')
    expect(jb).toContain(APP_READY)
    expect(jb).toContain(LOADING_OVERLAY)
  })

  it('is read by @jbrowse/capture with the same selectors', () => {
    const waits = read('products/jbrowse-capture/src/waits.ts')
    expect(waits).toContain(`APP_READY = '${APP_READY}'`)
    expect(waits).toContain(`LOADING_OVERLAY = '${LOADING_OVERLAY}'`)
  })

  // The census beside the phase: AppReadyMarker publishes what is open as
  // attributes so capture's session gate reads one element instead of walking
  // window.JBrowseSession. Same doctrine as the phase selector — the strings
  // are the contract, and a rename in one file splits the readers silently,
  // presenting as a gate that never passes rather than as a broken build.
  it('the census attributes are published and read under the same names', () => {
    const marker = read('packages/app-core/src/ui/App/AppReadyMarker.tsx')
    const gate = read('products/jbrowse-capture/src/sessionGate.ts')
    for (const attr of [
      'data-app-views',
      'data-app-assemblies',
      'data-app-tracks',
    ]) {
      expect(marker).toContain(attr)
      expect(gate).toContain(attr)
    }
    expect(gate).toContain(`APP_CENSUS = '[data-app-tracks]'`)
  })
})
