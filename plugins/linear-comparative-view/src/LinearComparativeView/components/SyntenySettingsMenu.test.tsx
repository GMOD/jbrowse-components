import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { when } from 'mobx'

import { packSyntenyFeatureData } from '../../LinearSyntenyDisplay/testUtils.ts'
import SyntenySettingsMenu from './SyntenySettingsMenu.tsx'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Showing a synteny track starts a real fetch through the main-thread RPC
// driver, and there are no fixture files behind these adapters — the menu is
// what is under test, not the data, and every gate it reads answers before a
// byte lands. So each test logs one adapter error while it runs, and would
// leave that fetch in flight at teardown as well; closing the view is what the
// app does and is what stops the autorun.
type WebSession = ReturnType<typeof createTestSession>

const opened: { session: WebSession; view: LinearSyntenyViewModel }[] = []

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

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

// Which adapter the pair is opened with is the whole of what gates the two
// Detail rows: `trackHasLodTiers` reads the threshold SLOT, so a plain
// PAFAdapter has no tier to switch to and the indexed one does. Neither reads
// the file, so no fixture is needed to tell them apart.
const PAF = {
  type: 'PAFAdapter',
  pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
  queryAssembly: 'volvox',
  targetAssembly: 'volvox2',
}

const PIF = {
  type: 'PairwiseIndexedPAFAdapter',
  pifGzLocation: { uri: 'volvox.pif.gz', locationType: 'UriLocation' },
  index: {
    location: { uri: 'volvox.pif.gz.tbi', locationType: 'UriLocation' },
    indexType: 'TBI',
  },
  assemblyNames: ['volvox', 'volvox2'],
}

async function openMenu(adapter: Record<string, unknown> = PAF) {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addTrackConf({
    type: 'SyntenyTrack',
    trackId: 'pair',
    name: 'pair',
    assemblyNames: ['volvox', 'volvox2'],
    adapter,
  })
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
      tracks: ['pair'],
    },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  // the CIGAR row is gated on there being a synteny display to ask, and one
  // arrives a tick after the rows do
  await when(() => view.allSyntenyDisplays.length > 0, { timeout: 5000 })

  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <SyntenySettingsMenu model={view} />
    </ThemeProvider>,
  )
  fireEvent.click(screen.getByRole('button'))
  opened.push({ session, view })
  return view
}

// Opens a radio submenu and clicks one of its options. The submenu rows carry
// the testid `CascadingMenu` slugs from their label, which is what tells two
// open-at-once "Off" rows apart.
function pick(row: string, option: string) {
  const slug = row.toLowerCase().replaceAll(' ', '_')
  fireEvent.click(screen.getByTestId(`cascading-submenu-${slug}`))
  fireEvent.click(screen.getByText(option))
}

// The division this menu exists to state: everything about how the ribbons
// look, in one place, whatever the setting's arity.
test('one menu holds every render setting', async () => {
  await openMenu()
  for (const label of [
    'Identity fade',
    'Curved lines',
    'Location markers',
    'Thin fade',
    'Opacity',
    'CIGAR indels',
    'Off-screen mates',
    'Min length',
    'Overdraw',
  ]) {
    expect(screen.getByText(label)).toBeTruthy()
  }
})

// One row shape at the top level whatever the arity, so a continuous setting is
// a submenu row like the choices rather than a two-line block drawing a widget
// no other row has. The slider is a hover in, behind the lazy chunk every
// inline menu slider row loads through.
test('a continuous setting keeps its slider one hop in', async () => {
  await openMenu()
  for (const slug of ['opacity', 'min_length', 'overdraw']) {
    expect(screen.getByTestId(`cascading-submenu-${slug}`)).toBeTruthy()
  }
  expect(screen.queryByTestId('opacity-slider')).toBeNull()
  fireEvent.click(screen.getByTestId('cascading-submenu-opacity'))
  expect(await screen.findByTestId('opacity-slider')).toBeTruthy()
})

// Gated on the data rather than shown inert: PAFAdapter has one tier, so there
// is nothing for this row to switch between.
test('an adapter with no tiers is offered no level of detail', async () => {
  await openMenu()
  expect(screen.queryByText('Level of detail')).toBeNull()
  // and the heading over that section stays, because the CIGAR row is still
  // under it — a PAF carries ops whether or not it carries a coarse tier
  expect(screen.getByText('Detail')).toBeTruthy()
})

test('an indexed adapter is offered the tier it can switch to', async () => {
  await openMenu(PIF)
  expect(screen.getByText('Level of detail')).toBeTruthy()
})

// The one combination that would leave a heading with nothing under it: a PAF
// with no tier to switch to AND no CIGAR ops to draw. `hasCigarData` is
// optimistic until a display has reported back, so this has to land a fetch
// that says so rather than configure it.
test('a section whose every row is gated out takes its heading with it', async () => {
  const view = await openMenu()
  expect(screen.getByText('Detail')).toBeTruthy()

  // in `act`, because this writes the model directly rather than through a
  // click: without it the getter flips and the menu has not re-rendered yet,
  // so the assertion below reads the previous frame
  act(() => {
    for (const d of view.allSyntenyDisplays) {
      d.setRpcData(
        packSyntenyFeatureData([], { hasCigar: false }),
        undefined,
        'k',
      )
    }
  })
  expect(view.hasCigarData).toBe(false)
  expect(screen.queryByText('Detail')).toBeNull()
  // the sections that still have rows are untouched
  expect(screen.getByText('Ribbons')).toBeTruthy()
  expect(screen.getByText('Scope')).toBeTruthy()
})

// The mirror, and the reason the heading is derived from its rows rather than by
// re-testing what gated them: one row gone is not the section gone. A tiered
// file with no CIGAR ops keeps Detail, carrying Level of detail alone.
test('a section keeps its heading while any one row survives', async () => {
  const view = await openMenu(PIF)
  expect(screen.getByText('CIGAR indels')).toBeTruthy()

  act(() => {
    for (const d of view.allSyntenyDisplays) {
      d.setRpcData(
        packSyntenyFeatureData([], { hasCigar: false }),
        undefined,
        'k',
      )
    }
  })

  expect(view.hasCigarData).toBe(false)
  expect(screen.queryByText('CIGAR indels')).toBeNull()
  expect(screen.getByText('Detail')).toBeTruthy()
  expect(screen.getByText('Level of detail')).toBeTruthy()
})

// Three steps of one question rather than two checkboxes of two: the first is a
// repaint of what the worker already counted and the last costs a query, so what
// a reader picks is how hard to look.
test('the last off-screen step is the one that adds the second query', async () => {
  const view = await openMenu()
  expect(view.showOffscreenMates).toBe(true)
  expect(view.bidirectionalFetch).toBe(false)

  pick('Off-screen mates', 'Query the lower panel too, and mark it as well')
  expect(view.bidirectionalFetch).toBe(true)

  pick('Off-screen mates', 'Off')
  expect(view.showOffscreenMates).toBe(false)
  expect(view.bidirectionalFetch).toBe(false)
})

test('the CIGAR row sets the mode it names', async () => {
  const view = await openMenu()
  pick('CIGAR indels', 'Transparent indels')
  expect(view.cigarMode).toBe('matches')
})

// A settings row keeps the menu open, so the reader can flip several in one
// visit — which is what `CascadingMenu` gives a checkbox row by its type.
test('a checkbox row writes its boolean and leaves the menu up', async () => {
  const view = await openMenu()
  expect(view.drawCurves).toBe(false)
  fireEvent.click(screen.getByText('Curved lines'))
  expect(view.drawCurves).toBe(true)
  expect(screen.getByText('Location markers')).toBeTruthy()
})

// A custom row draws its own content, so the value it reports is the model's
// rather than a menu decoration — the caption is where a reader reads it back.
test('a slider row captions the value it is set to', async () => {
  const view = await openMenu()
  fireEvent.click(screen.getByTestId('cascading-submenu-opacity'))
  expect(await screen.findByText('Opacity: 0.200')).toBeTruthy()
  act(() => {
    view.setAlpha(0.5)
  })
  expect(screen.getByText('Opacity: 0.500')).toBeTruthy()
})
