import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import LinearSyntenyImportForm from './LinearSyntenyImportForm.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  jest.restoreAllMocks()
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
          end: 100,
          seq: 'A'.repeat(100),
        },
      ],
    },
  },
})

const syntenyTrack = (trackId: string, assemblyNames: string[]) => ({
  type: 'SyntenyTrack',
  trackId,
  name: trackId,
  assemblyNames,
  adapter: { type: 'FromConfigAdapter', features: [] },
})

function setup({
  assemblyNames = ['hg38', 'mm39'],
  tracks = [],
  connectionTracks,
}: {
  assemblyNames?: string[]
  tracks?: ReturnType<typeof syntenyTrack>[]
  // tracks a connection supplies, which live outside session.tracks
  connectionTracks?: ReturnType<typeof syntenyTrack>[]
} = {}) {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: assemblyNames.map(assembly),
      tracks,
      connections: connectionTracks
        ? [{ type: 'JBrowse1Connection', connectionId: 'conn', name: 'conn' }]
        : [],
    },
    // no views on the synteny view, which is what puts it on the import form
    sessionSnapshot: {
      views: [{ id: 'syntenyview', type: 'LinearSyntenyView' }],
    },
  })
  const model = session.views[0] as unknown as LinearSyntenyViewModel
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearSyntenyImportForm model={model} />
    </ThemeProvider>,
  )
  return {
    model,
    session,
    // brings the connection up with its tracks already in its initial
    // snapshot, inside act so React sees the observable change. The conf is
    // hydrated from config, so it is a real configuration model rather than a
    // plain snapshot. Tracks go in up front rather than via addTrackConfs
    // after attach: BaseConnectionModelFactory's afterAttach only fires the
    // connection's real connect() when it attaches with an empty tracks
    // array, and this connection stub has no dataDirLocation for connect()
    // to fetch from.
    loadConnection: () => {
      // the connection connect()s on attach and rejects without an assembly
      // name; the tracks it carries are handed over below, so keep that one
      // error quiet while letting every other console.error through
      const realError = console.error
      jest.spyOn(console, 'error').mockImplementation((...args) => {
        if (!`${args[0]}`.includes('JBrowse 1 connection')) {
          realError(...args)
        }
      })
      act(() => {
        session.makeConnection(session.connections[0]!, {
          tracks: connectionTracks ?? [],
        })
      })
    },
    ...utils,
  }
}

const rowSelects = () =>
  within(screen.getByTestId('synteny-assembly-rows')).getAllByRole('combobox')

const launchButton = () => screen.getByRole('button', { name: 'Launch' })

// the per-pair heading, which is also the track radio group's accessible name
const pairHeading = () => screen.getByRole('status')

// the assembly each row was built for. A row's `assemblyNames` derives from
// displayedRegions, which its afterAttach autorun loads asynchronously, so the
// declarative init is what a synchronous launch can be checked against.
const launchedRows = (model: LinearSyntenyViewModel) =>
  model.views.map(v => v.init?.assembly)

// the synteny track on each level. A level's `tracks` is loosely typed, so the
// track is annotated rather than cast.
const levelTrackIds = (model: LinearSyntenyViewModel) =>
  model.levels.map(level =>
    level.tracks.map(
      (track: { configuration: { trackId: string } }) =>
        track.configuration.trackId,
    ),
  )

const goManual = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Manual' }))
}

// A Tooltip wrapping a button directly becomes that button's accessible name, so
// this one is queried by tooltip text rather than by its label
const autoArrangeButton = () =>
  screen.getByRole('button', { name: /Reorder rows so adjacent pairs/ })

// MUI's Select opens its menu on mouseDown, not click
function pickAssembly(rowIdx: number, assemblyName: string) {
  fireEvent.mouseDown(rowSelects()[rowIdx]!)
  fireEvent.click(screen.getByRole('option', { name: assemblyName }))
}

test('an empty session opens on Manual with two different assemblies', () => {
  // both rows on one assembly would need a self-alignment track, so it would
  // open already flagged
  setup()
  expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'mm39'])
})

test('a session with a synteny track opens on Quick start', () => {
  setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  expect(screen.getByRole('button', { name: 'Quick start' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByTestId('quick-start-rows')).toHaveTextContent('1. hg38')
  expect(screen.getByTestId('quick-start-rows')).toHaveTextContent('2. mm39')
})

test('Swap reverses the rows the track implies', () => {
  setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  // the Tooltip title becomes the button's accessible name
  fireEvent.click(screen.getByRole('button', { name: /Reverse the row order/ }))
  const rows = screen.getByTestId('quick-start-rows')
  expect(rows.textContent).toMatch(/1\. mm39.*2\. hg38/s)
})

test('Quick start launch builds one row per assembly and shows the track', () => {
  const { model } = setup({
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  fireEvent.click(launchButton())
  expect(launchedRows(model)).toEqual(['hg38', 'mm39'])
  expect(levelTrackIds(model)).toEqual([['hg38_mm39']])
})

test('an all-vs-all track stacks every assembly it names', () => {
  const { model } = setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('all', ['hg38', 'mm39', 'rn7'])],
  })
  expect(screen.getByTestId('quick-start-rows')).toHaveTextContent('3. rn7')
  fireEvent.click(launchButton())
  expect(launchedRows(model)).toEqual(['hg38', 'mm39', 'rn7'])
  // the one track backs both adjacent bands
  expect(levelTrackIds(model)).toEqual([['all'], ['all']])
})

test('switching to Manual hands over the rows Quick start had set up', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('all', ['hg38', 'mm39', 'rn7'])],
  })
  goManual()
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'mm39', 'rn7'])
  // handed over as configured, so both pairs draw the track
  expect(
    screen.queryByRole('button', { name: /No synteny dataset connects/ }),
  ).not.toBeInTheDocument()
})

test('the handover opens on the track pair, not the assembly-list order', () => {
  // the track pairs hg38 with rn7, so switching to Manual opens on those rows
  // even though mm39 comes first in the assembly list
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('hg38_rn7', ['hg38', 'rn7'])],
  })
  goManual()
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'rn7'])
})

test('a pair with no synteny dataset launches, stacking the rows blank', () => {
  const { model } = setup({ assemblyNames: ['hg38', 'mm39'] })
  expect(screen.getByTestId('synbutton')).toHaveAccessibleName(
    /No synteny dataset connects row 1 and 2/,
  )
  expect(launchButton()).toBeEnabled()
  fireEvent.click(launchButton())
  expect(launchedRows(model)).toEqual(['hg38', 'mm39'])
  expect(levelTrackIds(model)).toEqual([[]])
})

test('an unfinished new-track upload is the one thing that blocks launch', () => {
  setup({ assemblyNames: ['hg38', 'mm39'] })
  // picking "New track" starts an upload with no file yet; launching would drop it
  fireEvent.click(screen.getByRole('radio', { name: 'New track' }))
  expect(launchButton()).toBeDisabled()
  expect(screen.getByTestId('synbutton')).toHaveAccessibleName(
    /Finish the new synteny track for row 1 and 2/,
  )

  // clearing it back to None makes the same blank pair launchable again
  fireEvent.click(screen.getByRole('radio', { name: 'None' }))
  expect(launchButton()).toBeEnabled()
  expect(screen.getByTestId('synbutton')).toHaveAccessibleName(/set to None/)
})

test('a synteny track from a connection is applied to its pair', () => {
  const { model, loadConnection } = setup({
    assemblyNames: ['hg38', 'mm39'],
    connectionTracks: [syntenyTrack('conn_track', ['hg38', 'mm39'])],
  })
  expect(screen.getByTestId('synbutton')).toHaveAccessibleName(
    /No synteny dataset connects/,
  )
  loadConnection()
  expect(screen.getByTestId('synbutton')).toHaveAccessibleName(
    /Configure synteny track/,
  )
  fireEvent.click(launchButton())
  expect(levelTrackIds(model)).toEqual([['conn_track']])
})

test('Add row defaults to an assembly connected to the current bottom row', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [
      syntenyTrack('hg38_mm39', ['hg38', 'mm39']),
      syntenyTrack('mm39_rn7', ['mm39', 'rn7']),
    ],
  })
  goManual()
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  expect(rowSelects()).toHaveLength(3)
  // whichever connected assembly it picked, the new pair draws ribbons rather
  // than stacking blank
  expect(
    screen.queryByRole('button', { name: /No synteny dataset connects/ }),
  ).not.toBeInTheDocument()
})

test('Add row selects the pair it just created', () => {
  // otherwise the track panel keeps showing the pair the user had been on, and
  // the row they asked for is configured only if they go find its chain icon
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  goManual()
  expect(pairHeading()).toHaveTextContent('rows 1 and 2')
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  expect(pairHeading()).toHaveTextContent('rows 2 and 3')
})

test('the pair heading names the assemblies, not only the row numbers', () => {
  setup({ assemblyNames: ['hg38', 'mm39'] })
  expect(pairHeading()).toHaveTextContent('between hg38 and mm39')
})

test('removing a row drops that pair selection and keeps the others', () => {
  const { model } = setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [
      syntenyTrack('hg38_mm39', ['hg38', 'mm39']),
      syntenyTrack('mm39_rn7', ['mm39', 'rn7']),
    ],
  })
  goManual()
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  expect(rowSelects()).toHaveLength(3)
  // the Quick start handover configured pair 0; the added pair has no entry and
  // auto-picks at launch
  expect(model.importFormSyntenyTrackSelections).toHaveLength(1)

  fireEvent.click(screen.getByRole('button', { name: 'Remove row 3' }))
  expect(rowSelects()).toHaveLength(2)
  // the pair that vanished with the row took its selection; pair 0 kept its own
  expect(model.importFormSyntenyTrackSelections).toEqual([
    { type: 'preConfigured', value: 'hg38_mm39' },
  ])
  fireEvent.click(launchButton())
  expect(launchedRows(model)).toEqual(['hg38', 'mm39'])
  expect(levelTrackIds(model)).toEqual([['hg38_mm39']])
})

test('the last two rows cannot be removed', () => {
  setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  goManual()
  expect(screen.getByRole('button', { name: 'Remove row 1' })).toBeDisabled()
})

test('Reverse rows flips the stack, keeping every pair connected', () => {
  // Auto-arrange only fires for a pair with no dataset, so a fully connected
  // stack had no reordering control at all before this. Which genome is on top
  // is the user's call, not a property of the track.
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [
      syntenyTrack('hg38_mm39', ['hg38', 'mm39']),
      syntenyTrack('mm39_rn7', ['mm39', 'rn7']),
    ],
  })
  goManual()
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  pickAssembly(2, 'rn7')
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'mm39', 'rn7'])

  fireEvent.click(screen.getByRole('button', { name: /Reverse the row order/ }))
  expect(rowSelects().map(s => s.textContent)).toEqual(['rn7', 'mm39', 'hg38'])
  // the same adjacencies, so nothing has come unconnected
  expect(
    screen.queryByRole('button', { name: /No synteny dataset connects/ }),
  ).not.toBeInTheDocument()
})

test('Auto-arrange reorders rows so adjacent pairs share a dataset', () => {
  // hg38-rn7 and rn7-mm39 exist, so the launchable chain puts rn7 in the middle
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [
      syntenyTrack('hg38_rn7', ['hg38', 'rn7']),
      syntenyTrack('rn7_mm39', ['rn7', 'mm39']),
    ],
  })
  goManual()
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  // force a broken ordering: hg38 and mm39 are adjacent with no dataset between
  pickAssembly(1, 'mm39')
  pickAssembly(2, 'rn7')
  expect(
    screen.getByRole('button', {
      name: /No synteny dataset connects row 1 and 2/,
    }),
  ).toBeInTheDocument()

  fireEvent.click(autoArrangeButton())
  // rn7 is the hub, so it lands in the middle
  expect(rowSelects().map(s => s.textContent)).toEqual(['mm39', 'rn7', 'hg38'])
  expect(
    screen.queryByRole('button', { name: /No synteny dataset connects/ }),
  ).not.toBeInTheDocument()
})

test('Auto-arrange keeps a self-alignment pair adjacent', () => {
  setup({
    assemblyNames: ['hg38', 'mm39'],
    tracks: [
      syntenyTrack('hg38_self', ['hg38', 'hg38']),
      syntenyTrack('hg38_mm39', ['hg38', 'mm39']),
    ],
  })
  goManual()
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  pickAssembly(1, 'hg38')
  pickAssembly(2, 'mm39')

  // every pair has a dataset, so Auto-arrange isn't offered; the point is that
  // the self pair counts as connected
  expect(
    screen.queryByRole('button', { name: /No synteny dataset connects/ }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /Reorder rows so adjacent pairs/ }),
  ).not.toBeInTheDocument()
})

test('a same-assembly pair with no self-alignment track says so', () => {
  setup({
    assemblyNames: ['hg38', 'mm39'],
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  goManual()
  pickAssembly(1, 'hg38')
  expect(screen.getByTestId('synbutton')).toHaveAccessibleName(
    /both use hg38, which only a self-alignment track can connect/,
  )
  expect(
    screen.getByText(/no self-alignment synteny track/),
  ).toBeInTheDocument()
  // legal, just blank
  expect(launchButton()).toBeEnabled()
})
