import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { when } from 'mobx'

import { packSyntenyFeatureData } from '../../LinearSyntenyDisplay/testUtils.ts'
import SyntenySettingsPopover from './SyntenySettingsPopover.tsx'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Showing a synteny track starts a real fetch through the main-thread RPC
// driver, and there are no fixture files behind these adapters — the panel is
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

async function openPanel(adapter: Record<string, unknown> = PAF) {
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
      <SyntenySettingsPopover model={view} />
    </ThemeProvider>,
  )
  fireEvent.click(screen.getByRole('button'))
  opened.push({ session, view })
  return view
}

function pick(label: string, option: string) {
  fireEvent.mouseDown(screen.getByLabelText(label))
  fireEvent.click(within(screen.getByRole('listbox')).getByText(option))
}

// The division this panel exists to state: everything about how the ribbons
// look, in one place, whether it is a slider, a segmented toggle or a dropdown.
// The three at the end are the ones that used to be top-level rows of the header
// menu, where a reader tuning the picture had to know which of two surfaces held
// which half of it.
test('one panel holds every render setting', async () => {
  await openPanel()
  for (const label of [
    'Opacity:',
    'Identity fade:',
    'Thin fade:',
    'Curved lines:',
    'Location markers:',
    'CIGAR indels:',
    'Off-screen mates:',
    'Min length:',
    'Overdraw:',
  ]) {
    expect(screen.getByText(label)).toBeTruthy()
  }
})

// Gated on the data rather than shown inert: PAFAdapter has one tier, so there
// is nothing for this row to switch between.
test('an adapter with no tiers is offered no level of detail', async () => {
  await openPanel()
  expect(screen.queryByText('Level of detail:')).toBeNull()
  // and the heading over that section stays, because the CIGAR row is still
  // under it — a PAF carries ops whether or not it carries a coarse tier
  expect(screen.getByText('Detail')).toBeTruthy()
})

test('an indexed adapter is offered the tier it can switch to', async () => {
  await openPanel(PIF)
  expect(screen.getByText('Level of detail:')).toBeTruthy()
})

// The one combination that would leave a heading with nothing under it: a PAF
// with no tier to switch to AND no CIGAR ops to draw. `hasCigarData` is
// optimistic until a display has reported back, so this has to land a fetch
// that says so rather than configure it.
test('a section whose every row is gated out takes its heading with it', async () => {
  const view = await openPanel()
  expect(screen.getByText('Detail')).toBeTruthy()

  // in `act`, because this writes the model directly rather than through a
  // click: without it the getter flips and the panel has not re-rendered yet,
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

// Three steps of one question rather than two checkboxes of two: the first is a
// repaint of what the worker already counted and the last costs a query, so what
// a reader picks is how hard to look.
test('the last off-screen step is the one that adds the second query', async () => {
  const view = await openPanel()
  expect(view.showOffscreenMates).toBe(true)
  expect(view.bidirectionalFetch).toBe(false)

  pick('Off-screen mates', 'Mark them, both rows')
  expect(view.bidirectionalFetch).toBe(true)

  pick('Off-screen mates', 'Off')
  expect(view.showOffscreenMates).toBe(false)
  expect(view.bidirectionalFetch).toBe(false)
})

test('the CIGAR row sets the mode it names', async () => {
  const view = await openPanel()
  pick('CIGAR indels', 'Transparent indels')
  expect(view.cigarMode).toBe('matches')
})

test('a toggle row writes its boolean', async () => {
  const view = await openPanel()
  expect(view.drawCurves).toBe(false)
  fireEvent.click(within(screen.getByLabelText('Curved lines')).getByText('On'))
  expect(view.drawCurves).toBe(true)
})
