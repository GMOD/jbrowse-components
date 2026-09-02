import '@testing-library/jest-dom'

import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  mockConsoleWarn,
  openViewWithFileInput,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 80000 }

// How many panels the launched breakpoint split view ended up with. Chord clicks
// walk the breakend chain by default, so this is the visible result of the walk
// and the two tests below pin both of its outcomes on the same file. It went
// unpinned, and what the SV inspector's own refName resolution broke was
// therefore only ever reported as a missing view or a hanging findByTestId.
function panelCount(session: { views: unknown[] }) {
  return (session.views[2] as { views: unknown[] }).views.length
}

test('opens a vcf.gz file in the sv inspector view', () => {
  return mockConsoleWarn(async () => {
    const { session, findByTestId, findByText } = await openViewWithFileInput({
      menuPath: ['File', 'Add', 'SV inspector'],
      fileUrl: 'volvox.dup.renamed.vcf.gz',
    })

    fireEvent.click(await findByTestId('chord-vcf-0', {}, delay))

    // Click on split level option in the dialog
    fireEvent.click(await findByText('Split level (top/bottom)', {}, delay))

    // Click Open button
    fireEvent.click(await findByText('Open', {}, delay))

    await waitFor(() => {
      expect(session.views.length).toBe(3)
    })
    expect(session.views[2]!.displayName).toBe('bnd_A split detail')
    // Two panels: bnd_A (A:2700 → A:34200) and bnd_B are one junction written
    // from both ends, so the only junction at the far end is the way the walk
    // came. Nothing to follow is the walk working, not the walk failing — the
    // other test's record is the one with somewhere to go.
    expect(panelCount(session)).toBe(2)
  })
}, 90000)

test('opens a track with minimal adapter config via "Open from track"', () => {
  return mockConsoleWarn(async () => {
    const { session, findByText, findByTestId, findByLabelText } =
      await createView()

    fireEvent.click(await findByText('File'))
    fireEvent.click(await findByText('Add'))
    fireEvent.click(await findByText('SV inspector'))

    fireEvent.click(await findByLabelText('Open from track', {}, delay))

    const trackDropdown = await findByLabelText('Tracks', {}, delay)
    fireEvent.mouseDown(trackDropdown)

    fireEvent.click(
      await findByText(
        '[Variants] volvox structural variant test w/renamed refs',
        {},
        delay,
      ),
    )

    const openButton = await findByTestId('open_spreadsheet', {}, delay)
    await waitFor(() => {
      expect(openButton.closest('button')).not.toBeDisabled()
    }, delay)

    fireEvent.click(openButton)

    fireEvent.click(await findByTestId('chord-vcf-6', {}, delay))

    // Click on split level option in the dialog
    fireEvent.click(await findByText('Split level (top/bottom)', {}, delay))

    // Click Open button
    fireEvent.click(await findByText('Open', {}, delay))

    await waitFor(() => {
      expect(session.views.length).toBe(3)
    }, delay)

    // Three: bnd_Y lands on A:21681, where bnd_V leaves for A:23456. Both hops
    // cross a refName the VCF spells `A`/`B` and the assembly calls `ctgA`/`ctgB`,
    // so this also pins that the chain resolves aliases — an unresolved name finds
    // no region and the launch throws before any view is added.
    expect(panelCount(session)).toBe(3)

    const breakpointView = session.views[2] as unknown as {
      views: { launchTrack: (t: string) => Promise<unknown> }[]
    }
    // Every panel, not the first two: the overlay renders only for tracks in
    // `matchedTracks`, which is the INTERSECTION across panels, so a track missing
    // from one panel draws no connections at all — including between the panels
    // that do have it. This record's breakends chain across three panels.
    for (const panel of breakpointView.views) {
      await panel.launchTrack('volvox_sv_test_renamed')
    }

    const container = await findByTestId(
      'volvox_sv_test_renamed-loaded',
      {},
      delay,
    )
    await waitFor(() => {
      expect(container.querySelectorAll('path').length).toBe(3)
    }, delay)
  })
}, 90000)
