import { AppReadyMarker } from '@jbrowse/app-core'
import { render, waitFor } from '@testing-library/react'

import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

// The embedded circular view starts a lazy adapter import that resolves after
// teardown otherwise, throwing "require after Jest environment has been torn
// down".
afterEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
})

utilizeFetchMockForTest(volvoxGetFile)

// SvInspectorView keeps its two halves on named props, so no spelling of the
// walk ADR-103 replaced ever reached them and a still-loading circle read as
// idle. Declaring them closes that, but only the gated declaration is safe, and
// the gate is a claim about the marker rather than about the view.
//
// Against the REAL marker over a REAL session, for the reason
// AppReadyMarkerComparative gives: each half is green on its own with the other
// missing. The plugin's own test proves `ownViews` holds what it should;
// app-core's proves an uninitialized view reads as loading. Neither notices
// that putting the two together is what parks the phase.

async function openSvInspector(spec: Record<string, unknown>) {
  const { rootModel } = await getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!
  // the default session opens an LGV that spends the test resolving its
  // assembly, and the phase is over the whole session — leaving it in means
  // reading `loading` whatever the SV inspector does
  for (const v of [...session.views]) {
    session.removeView(v)
  }
  const view = (await session.launchView('SvInspectorView', spec)) as {
    setWidth: (n: number) => void
    showCircularView: boolean
    variantTrackId: string
    circularView: { initialized: boolean; tracks: unknown[] }
  }
  view.setWidth(800)
  const marker = render(<AppReadyMarker session={session} />).getByTestId(
    'app-ready-marker',
  )
  return { view, marker }
}

// The regression the gate exists for. A circle that is not shown is never given
// a width, so `initialized` stays false for as long as the sheet sits on its
// import form — and the marker counts an uninitialized view as loading, so an
// ungated declaration parks the phase for the rest of the session.
test('an SV inspector on its import form reaches ready', async () => {
  const { view, marker } = await openSvInspector({ assembly: 'volvox' })

  await waitFor(() => {
    expect(marker.dataset.appPhase).toBe('ready')
  })
  expect(view.showCircularView).toBe(false)
  expect(view.circularView.initialized).toBe(false)
}, 40000)

// And the census gap itself: the chord track the view builds from the sheet
// lives on the circular view, so it reached no consumer asking the session what
// is open.
test('the loaded circle puts its chord track in the census', async () => {
  const { view, marker } = await openSvInspector({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  })

  await waitFor(
    () => {
      expect(view.showCircularView).toBe(true)
      expect(view.circularView.tracks.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )

  await waitFor(() => {
    expect(JSON.parse(marker.dataset.appTracks!)).toContain(view.variantTrackId)
    expect(marker.dataset.appPhase).toBe('ready')
  })
}, 40000)
