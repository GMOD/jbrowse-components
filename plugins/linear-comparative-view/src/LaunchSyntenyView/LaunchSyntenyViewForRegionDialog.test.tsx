import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import LaunchSyntenyViewForRegionDialog from './LaunchSyntenyViewForRegionDialog.tsx'

import type { MateDiscoveryResult } from './pickMatesForRegion.ts'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  Region,
} from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const region: Region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50000,
}

// The worker's answer: one resolved panel per mate assembly (see resolvePanel),
// not the alignments behind them.
function mates(...assemblyNames: string[]): MateDiscoveryResult {
  return {
    mates: assemblyNames.map(assemblyName => ({
      assemblyName,
      refName: 'ctgB',
      anchorStart: 0,
      anchorEnd: 100,
      mateStart: 0,
      mateEnd: 100,
      reversed: false,
    })),
    unconfigured: [],
  }
}

// One mate whose alignment covers the middle of the selection, on the minus
// strand and against a mate contig far from where the anchor sits.
function invertedMate(): MateDiscoveryResult {
  return {
    unconfigured: [],
    mates: [
      {
        assemblyName: 'volvox_inv',
        refName: 'ctgZ',
        anchorStart: 10000,
        anchorEnd: 20000,
        mateStart: 800000,
        mateEnd: 810000,
        reversed: true,
      },
    ],
  }
}

function renderDialog(
  discoverMates: (stopToken: StopToken) => Promise<MateDiscoveryResult>,
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
  ) => (stopToken: StopToken) => Promise<MateDiscoveryResult>,
  {
    session = {} as AbstractSessionModel,
    sourceView,
  }: { session?: AbstractSessionModel; sourceView?: AbstractViewModel } = {},
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaunchSyntenyViewForRegionDialog
        session={session}
        region={region}
        tracks={tracks}
        sourceView={sourceView}
        discoverMatesFor={discoverMatesFor}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
}

// isSessionModel wants these two members; `views` is the slot list the replace
// offer is really about.
function replaceableSession(views: unknown[]) {
  return {
    rpcManager: {},
    configuration: {},
    views,
    replaceView: () => {},
  } as unknown as AbstractSessionModel
}

// A selection can be a whole chromosome, and the download+parse behind the
// discovery is what honors the token — so dismissing the dialog has to stop it
// rather than leave a worker parsing for a view nobody is waiting for.
test('dismissing the dialog stops the discovery it started', () => {
  let captured: StopToken | undefined
  const { unmount } = renderDialog(stopToken => {
    captured = stopToken
    // never settles: the fetch is still in flight when the dialog closes
    return new Promise<MateDiscoveryResult>(() => {})
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

// What failed is a fetch over the network. Without a retry the only way past a
// blip was to cancel out and find the menu entry again, losing the dataset, the
// panel order and the options chosen before it.
test('a failed discovery can be retried in place', async () => {
  let attempt = 0
  renderDialog(() => {
    attempt += 1
    return attempt === 1
      ? Promise.reject(new Error('tabix query failed'))
      : Promise.resolve(mates('volvox_ins'))
  })
  fireEvent.click(await screen.findByText('Retry'))
  expect(await screen.findByLabelText('volvox_ins')).toBeTruthy()
  expect(screen.queryByText(/tabix query failed/)).toBeNull()
})

// The anchor is a row so it can be moved through the stack, but it is where the
// coordinates came from, so it cannot be dropped from it. Said with a mark
// rather than a disabled checkbox: `disabled` greyed out the row every other row
// is measured against, and took its name out of the tab order while leaving its
// own move buttons in it.
test('the anchor is listed first, as a mark rather than a dead checkbox', async () => {
  renderDialog(() => Promise.resolve(mates('volvox_ins', 'volvox_del')))
  expect(await screen.findByText('volvox (your selection)')).toBeTruthy()
  expect(screen.queryByLabelText(/volvox \(your selection\)/)).toBeNull()
  expect(screen.getByLabelText('Move volvox (panel 1) up')).toBeDisabled()
  expect(screen.getByLabelText('Move volvox (panel 1) down')).toBeEnabled()
})

test('select none leaves the anchor in the stack and disables submit', async () => {
  renderDialog(() =>
    Promise.resolve(mates('volvox_ins', 'volvox_del', 'volvox_dup')),
  )
  fireEvent.click(await screen.findByText('Select none'))

  expect(screen.getByText('volvox (your selection)')).toBeTruthy()
  expect(screen.getByLabelText('volvox_ins')).not.toBeChecked()
  expect(screen.getByText('Submit').closest('button')).toBeDisabled()

  fireEvent.click(screen.getByText('Select all'))
  expect(screen.getByLabelText('volvox_ins')).toBeChecked()
  expect(screen.getByText('Submit').closest('button')).toBeEnabled()
})

// One open synteny dataset is not a choice, and a full-width select holding its
// only value is a control the reader has to try before ruling it out.
test('a single dataset is stated rather than offered as a select', async () => {
  renderDialog(() => Promise.resolve(mates('volvox_ins')))
  expect(await screen.findByText('Synteny dataset: all vs all')).toBeTruthy()
  expect(screen.queryByRole('combobox', { name: 'Synteny dataset' })).toBeNull()
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

// The assembly name alone says nothing about where in that assembly the
// selection lands, which is what decides whether a panel is worth opening. The
// locus shown is resolved exactly as the launch resolves it — clipped through
// the CIGAR — so it is a preview of the panel rather than the whole block.
test('each mate row shows the locus its panel will open on', async () => {
  renderDialog(() => Promise.resolve(invertedMate()))
  expect(
    await screen.findByText('ctgZ:800,001..810,000 (-) (10Kbp)'),
  ).toBeTruthy()
})

// The column is read down — a mate's locus says little except against the
// anchor's — so the row every other row was resolved against is in it, title
// line above notwithstanding. And it is where the anchor panel will actually
// open, not the selection: every panel is clipped to the region, so a selection
// whose flanks align to nothing opens narrower than it was dragged, and the two
// lines are readable against each other. Here the one mate covers 10,000-20,000
// of a 0-50,000 selection.
test('the anchor row carries the locus its own panel will open on', async () => {
  renderDialog(() => Promise.resolve(invertedMate()))
  await screen.findByLabelText('volvox_inv')
  expect(screen.getByText('ctgA:10,001..20,000 (10Kbp)')).toBeTruthy()
})

// Unchecking the last mate leaves no launch to describe, so the anchor row goes
// back to the selection rather than to whatever the panel it just lost resolved.
test('the anchor row falls back to the selection with nothing checked', async () => {
  renderDialog(() => Promise.resolve(invertedMate()))
  fireEvent.click(await screen.findByLabelText('volvox_inv'))
  // two: the title line and the anchor row, which now agree. Submit is off in
  // this state anyway — there is no launch left for the row to describe.
  expect(screen.getAllByText('ctgA:1..50,000 (50Kbp)')).toHaveLength(2)
})

// The launch is anchored on the locus the rubberband was dragged over, so the
// launched view is as reasonable a replacement for the view it came from as an
// addition below it. Both buttons are on offer, and Submit is renamed so the
// pair can be told apart.
describe('the two destinations', () => {
  const lgv = {} as AbstractViewModel

  test('a launching view the session holds a slot for can be replaced', async () => {
    renderDialogFor(
      [{ trackId: 't1', name: 'all vs all' }],
      () => () => Promise.resolve(mates('volvox_ins')),
      { session: replaceableSession([lgv]), sourceView: lgv },
    )
    expect(await screen.findByText('Open in new view')).toBeTruthy()
    expect(screen.getByText('Replace current view')).toBeTruthy()
    expect(screen.queryByText('Submit')).toBeNull()
  })

  // The LGV row of a synteny view: getContainingView names it, but the session
  // holds no slot for it, so replaceView would append while the button said
  // otherwise.
  test('a view outside the session stack gets the one honest button', async () => {
    renderDialogFor(
      [{ trackId: 't1', name: 'all vs all' }],
      () => () => Promise.resolve(mates('volvox_ins')),
      { session: replaceableSession([{}]), sourceView: lgv },
    )
    expect(await screen.findByText('Submit')).toBeTruthy()
    expect(screen.queryByText('Replace current view')).toBeNull()
  })

  // both buttons launch the same view, so neither may be live before there is
  // one to launch
  test('the replace button is disabled alongside submit', async () => {
    renderDialogFor(
      [{ trackId: 't1', name: 'all vs all' }],
      () => () => Promise.resolve(mates('volvox_ins')),
      { session: replaceableSession([lgv]), sourceView: lgv },
    )
    fireEvent.click(await screen.findByLabelText('volvox_ins'))
    expect(
      screen.getByText('Replace current view').closest('button'),
    ).toBeDisabled()
  })
})

// A whole-chromosome selection makes this a long wait, and a bare spinner in a
// dialog that has just changed dataset says nothing about what it is doing.
test('the discovery in flight says what it is waiting on', () => {
  renderDialog(() => new Promise<MateDiscoveryResult>(() => {}))
  expect(
    screen.getByText(/Finding assemblies that align to this region/),
  ).toBeTruthy()
})

// An all-vs-all file holds every sample it was built with, and only the ones the
// track declares an assembly for can become a panel. Reporting the rest as
// "nothing aligns here" contradicts the lanes the user can see drawn in the
// track they launched from, which is where they clicked.
describe('mates with no declared assembly', () => {
  test('the empty case says they aligned rather than that nothing did', async () => {
    renderDialog(() =>
      Promise.resolve({ mates: [], unconfigured: ['HG002#1', 'HG005#2'] }),
    )
    expect(
      await screen.findByText(
        /all vs all aligns here only to HG002#1, HG005#2, which this track declares no assembly for/,
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/Nothing in/)).toBeNull()
  })

  test('alongside real panels they are a note, not the whole message', async () => {
    renderDialog(() =>
      Promise.resolve({
        ...mates('volvox_ins'),
        unconfigured: ['HG002#1'],
      }),
    )
    expect(await screen.findByLabelText('volvox_ins')).toBeTruthy()
    expect(
      screen.getByText(/HG002#1 also align here, but this track declares no/),
    ).toBeTruthy()
  })

  // a locus on a 90-haplotype file would otherwise spill the dialog
  test('a long list is capped with a count', async () => {
    renderDialog(() =>
      Promise.resolve({
        mates: [],
        unconfigured: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      }),
    )
    expect(await screen.findByText(/a, b, c, d, e, and 2 more/)).toBeTruthy()
  })

  test('none of them means the plain message', async () => {
    renderDialog(() => Promise.resolve({ mates: [], unconfigured: [] }))
    expect(
      await screen.findByText('Nothing in all vs all aligns to this region'),
    ).toBeTruthy()
  })
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
        ? new Promise<MateDiscoveryResult>(() => {})
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
