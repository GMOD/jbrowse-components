import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import LaunchSyntenyViewForRegionDialog from './LaunchSyntenyViewForRegionDialog.tsx'

import type { MateCandidate } from './pickMatesForRegion.ts'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const region: Region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50000,
}

function mates(...assemblyNames: string[]): MateCandidate[] {
  return assemblyNames.map(assemblyName => ({
    assemblyName,
    feature: new SimpleFeature({
      uniqueId: assemblyName,
      refName: 'ctgA',
      start: 0,
      end: 100,
      mate: { refName: 'ctgB', start: 0, end: 100, assemblyName },
    }),
  }))
}

function renderDialog(
  discoverMates: (stopToken: StopToken) => Promise<MateCandidate[]>,
) {
  return renderDialogFor(
    [{ trackId: 't1', name: 'all vs all' }],
    () => discoverMates,
  )
}

function renderDialogFor(
  tracks: { trackId: string; name: string }[],
  discoverMatesFor: (
    trackId: string,
  ) => (stopToken: StopToken) => Promise<MateCandidate[]>,
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaunchSyntenyViewForRegionDialog
        session={{} as AbstractSessionModel}
        region={region}
        tracks={tracks}
        discoverMatesFor={discoverMatesFor}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
}

// A selection can be a whole chromosome, and the download+parse behind the
// discovery is what honors the token — so dismissing the dialog has to stop it
// rather than leave a worker parsing for a view nobody is waiting for.
test('dismissing the dialog stops the discovery it started', () => {
  let captured: StopToken | undefined
  const { unmount } = renderDialog(stopToken => {
    captured = stopToken
    // never settles: the fetch is still in flight when the dialog closes
    return new Promise<MateCandidate[]>(() => {})
  })

  expect(captured).toBeDefined()
  expect(() => {
    checkStopToken(captured)
  }).not.toThrow()

  unmount()
  expect(() => {
    checkStopToken(captured)
  }).toThrow(/aborted/i)
})

test('a failed discovery surfaces rather than spinning forever', async () => {
  renderDialog(() => Promise.reject(new Error('tabix query failed')))
  expect(await screen.findByText(/tabix query failed/)).toBeTruthy()
})

// The anchor is a row so it can be moved through the stack, but it is where the
// coordinates came from, so it cannot be dropped from it.
test('the anchor is listed first and its checkbox is disabled', async () => {
  renderDialog(() => Promise.resolve(mates('volvox_ins', 'volvox_del')))
  const anchor = await screen.findByLabelText(/volvox \(your selection\)/)
  expect(anchor).toBeDisabled()
  expect(anchor).toBeChecked()
  expect(screen.getByLabelText('Move volvox up')).toBeDisabled()
  expect(screen.getByLabelText('Move volvox down')).toBeEnabled()
})

test('select none leaves the anchor checked and disables submit', async () => {
  renderDialog(() =>
    Promise.resolve(mates('volvox_ins', 'volvox_del', 'volvox_dup')),
  )
  fireEvent.click(await screen.findByText('Select none'))

  expect(screen.getByLabelText(/volvox \(your selection\)/)).toBeChecked()
  expect(screen.getByLabelText('volvox_ins')).not.toBeChecked()
  expect(screen.getByText('Submit').closest('button')).toBeDisabled()

  fireEvent.click(screen.getByText('Select all'))
  expect(screen.getByLabelText('volvox_ins')).toBeChecked()
  expect(screen.getByText('Submit').closest('button')).toBeEnabled()
})

// a rubberband can cover a whole chromosome without looking like it
test('the region size is stated alongside the locstring', async () => {
  renderDialog(() => Promise.resolve(mates('volvox_ins')))
  // a function matcher because the line is several text nodes, not one
  expect(
    await screen.findByText(
      (_text, element) =>
        element?.tagName === 'P' &&
        element.textContent === 'ctgA:1..50,000 (50Kbp)',
    ),
  ).toBeTruthy()
})

// The dataset list is session-wide and can run to dozens, so it is a field here
// rather than a menu of them — which only works if picking one refetches the
// panels, since the panel list is what that dataset aligns to.
test('picking another dataset refetches its panels and drops the old ones', async () => {
  renderDialogFor(
    [
      { trackId: 't1', name: 'all vs all' },
      { trackId: 't2', name: 'mcscan' },
    ],
    trackId => () =>
      Promise.resolve(
        trackId === 't1' ? mates('volvox_ins') : mates('volvox_del'),
      ),
  )
  expect(await screen.findByLabelText('volvox_ins')).toBeTruthy()

  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Synteny dataset' }))
  fireEvent.click(screen.getByRole('option', { name: 'mcscan' }))

  expect(await screen.findByLabelText('volvox_del')).toBeTruthy()
  expect(screen.queryByLabelText('volvox_ins')).toBeNull()
})

// switching away is the same abandonment as closing: the discovery it started
// is a whole-chromosome fetch nobody is waiting for any more
test('switching dataset stops the discovery in flight', async () => {
  const tokens: Record<string, StopToken> = {}
  renderDialogFor(
    [
      { trackId: 't1', name: 'all vs all' },
      { trackId: 't2', name: 'mcscan' },
    ],
    trackId => stopToken => {
      tokens[trackId] = stopToken
      return trackId === 't1'
        ? new Promise<MateCandidate[]>(() => {})
        : Promise.resolve(mates('volvox_del'))
    },
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Synteny dataset' }))
  fireEvent.click(screen.getByRole('option', { name: 'mcscan' }))
  expect(await screen.findByLabelText('volvox_del')).toBeTruthy()

  expect(() => {
    checkStopToken(tokens.t1)
  }).toThrow(/aborted/i)
  expect(() => {
    checkStopToken(tokens.t2)
  }).not.toThrow()
})
