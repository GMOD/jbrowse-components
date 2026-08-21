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
  const view = session.addView('DotplotView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
      tracks: ['pair'],
    },
  }) as DotplotViewModel
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

// A custom row draws its own content, so the value it reports is the model's.
test('a slider row captions the value it is set to', async () => {
  const view = await openMenu()
  fireEvent.click(screen.getByTestId('cascading-submenu-line_width'))
  expect(await screen.findByText('Line width: 2.5px')).toBeTruthy()
  expect(view.lineWidth).toBe(2.5)
}, 20000)

// A checkbox row is a `menuitem` whose glyph carries the state, so the state is
// read off the glyph rather than an aria attribute the row does not set.
function checkboxRow(name: string | RegExp) {
  return screen.getByRole('menuitem', { name })
}

function isTicked(name: string | RegExp) {
  return Boolean(
    checkboxRow(name).querySelector('[data-testid="CheckBoxIcon"]'),
  )
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
