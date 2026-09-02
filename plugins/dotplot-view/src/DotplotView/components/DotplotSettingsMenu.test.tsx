import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { when } from 'mobx'

import DotplotSettingsMenu from './DotplotSettingsMenu.tsx'

import type { DotplotViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Opening a dotplot track starts a real fetch with no fixture behind it, so
// each test logs one adapter error while it runs; what is under test is the
// menu, and every gate it reads answers before a byte lands.
type WebSession = ReturnType<typeof createTestSession>

const opened: { session: WebSession; view: DotplotViewModel }[] = []

afterEach(() => {
  for (const { session, view } of opened) {
    session.removeView(view)
  }
  opened.length = 0
})

// Both shapes this suite provokes go through `console.error`: the adapter
// failure above, and the `no session model found!` a fetch still in flight
// raises once `afterEach` has taken its view out — `removeView` detaches rather
// than destroys (ADR-069), so the fetch's `isCurrent` guard still reads the
// display as alive and reports. Taken here; anything else still prints, so the
// contract gate keeps working.
const provoked = /Offset is outside the bounds|no session model found/
let reported: jest.SpyInstance
beforeAll(() => {
  const print = console.error
  reported = jest
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      if (!provoked.test(args.map(a => `${a}`).join(' '))) {
        print(...args)
      }
    })
})
afterAll(() => {
  expect(reported).toHaveBeenCalled()
  reported.mockRestore()
})

// Which adapter the view is opened with is the whole of what gates the Level of
// detail row: `trackHasLodTiers` reads the threshold SLOT, so a plain
// PAFAdapter has no tier to switch to and the indexed one does.
const PAF = {
  type: 'PAFAdapter',
  pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
  queryAssembly: 'volvox',
  targetAssembly: 'volvox',
}

const PIF = {
  type: 'PairwiseIndexedPAFAdapter',
  pifGzLocation: { uri: 'volvox.pif.gz', locationType: 'UriLocation' },
  index: {
    location: { uri: 'volvox.pif.gz.tbi', locationType: 'UriLocation' },
    indexType: 'TBI',
  },
  assemblyNames: ['volvox', 'volvox'],
}

async function openMenu(adapter: Record<string, unknown> = PAF) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
        ],
      },
    },
  })
  session.addTrackConf({
    type: 'SyntenyTrack',
    trackId: 'pair',
    name: 'pair',
    assemblyNames: ['volvox', 'volvox'],
    adapter,
  })
  const view = (await session.launchView('DotplotView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
    tracks: ['pair'],
  })) as DotplotViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.initialized)

  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DotplotSettingsMenu model={view} />
    </ThemeProvider>,
  )
  fireEvent.click(screen.getByRole('button'))
  opened.push({ session, view })
  return view
}

// The three sliders and, when the file has tiers, the row that used to be in
// the ⋮ menu instead — split off from the sliders it belongs beside by widget
// type rather than by subject. Every one is the same row shape, the synteny
// menu's: the slider is a hover in rather than drawn in the row.
test('one menu holds every setting that decides what the plot looks like', async () => {
  await openMenu(PIF)
  for (const label of [
    'Draw CIGAR insertions/deletions',
    /^Gridlines/,
    'Level of detail',
    'Opacity',
    'Line width',
    'Min length',
    'Min identity',
  ]) {
    expect(screen.getByText(label)).toBeTruthy()
  }
  fireEvent.click(screen.getByTestId('cascading-submenu-opacity'))
  expect(await screen.findByTestId('opacity-slider')).toBeTruthy()
}, 20000)

// Gated on the data rather than shown inert: PAFAdapter has one tier, so there
// is nothing for this row to switch between.
test('an adapter with no tiers is offered no level of detail', async () => {
  await openMenu()
  expect(screen.getByText('Opacity')).toBeTruthy()
  expect(screen.queryByText('Level of detail')).toBeNull()
}, 20000)

// A custom row draws its own content, so the value it reports is the model's
// rather than a menu decoration. Asserting the default alone cannot tell the
// two apart — a row captioning a constant reads the same — so the caption has
// to follow the model off its default.
test('a slider row captions the value it is set to', async () => {
  const view = await openMenu()
  fireEvent.click(screen.getByTestId('cascading-submenu-line_width'))
  expect(await screen.findByText('Line width: 2.5px')).toBeTruthy()
  act(() => {
    view.setLineWidth(5)
  })
  expect(screen.getByText('Line width: 5px')).toBeTruthy()
}, 20000)

// The identity filter is a fraction in the model and a percentage in the row,
// so the caption is the one place that conversion is visible.
test('the identity row captions the model fraction as a percentage', async () => {
  const view = await openMenu()
  fireEvent.click(screen.getByTestId('cascading-submenu-min_identity'))
  expect(await screen.findByText('Min identity: 0%')).toBeTruthy()
  act(() => {
    view.setMinIdentity(0.9)
  })
  expect(screen.getByText('Min identity: 90%')).toBeTruthy()
}, 20000)

function checkboxRow(name: string | RegExp) {
  return screen.getByRole('menuitemcheckbox', { name })
}

function isTicked(name: string | RegExp) {
  return checkboxRow(name).getAttribute('aria-checked') === 'true'
}

// Both checkboxes came out of the ⋮ menu's "Show..." submenu, which filed them
// by widget kind while their synteny twins were already settings. Asserted in
// both polarities, since a row rendering its glyph from a constant passes
// either one alone.
test.each([
  ['Draw CIGAR insertions/deletions', 'setDrawCigar', 'drawCigar'],
  // matched loosely because the label carries `withHint`, which appends an
  // aside at a zoom with no ruler to cast
  [/^Gridlines/, 'setShowGridlines', 'showGridlines'],
] as const)(
  'a row moved out of the ⋮ menu reports the model and writes it back',
  async (name, setter, prop) => {
    const view = await openMenu()
    expect(isTicked(name)).toBe(true)

    act(() => {
      view[setter](false)
    })
    expect(isTicked(name)).toBe(false)

    fireEvent.click(checkboxRow(name))
    expect(view[prop]).toBe(true)
  },
  20000,
)
