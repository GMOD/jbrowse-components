import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import LinearSyntenyImportForm from './LinearSyntenyImportForm.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  jest.restoreAllMocks()
})

const assembly = (name: string, aliases: string[] = []) => ({
  name,
  aliases,
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
  aliases = {},
  tracks = [],
  connectionTracks,
  contribute,
}: {
  assemblyNames?: string[]
  // other names for an assembly, which a track config is free to use
  aliases?: Record<string, string[]>
  tracks?: ReturnType<typeof syntenyTrack>[]
  // tracks a connection supplies, which live outside session.tracks
  connectionTracks?: ReturnType<typeof syntenyTrack>[]
  // runs against the session's plugin manager before the first render, which is
  // where a plugin's own contributions would already be
  contribute?: (pluginManager: PluginManager) => void
} = {}) {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: assemblyNames.map(name => assembly(name, aliases[name])),
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
  contribute?.(getEnv(session).pluginManager)
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
  model.views.map(v => v.pendingLaunch?.assembly)

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

// by testid, not by label: every row's box shares a placeholder, and the testid
// is what ChromosomeFilter puts on the input for exactly this
const chromosomeBox = (row: number) =>
  screen.getByTestId(`chromosome-filter-row-${row}`)

// The boxes are off until asked for, so anything about what goes IN them opens
// them first.
const chromosomesCheckbox = () =>
  screen.getByRole('checkbox', { name: 'Show only certain chromosomes' })

const showChromosomeBoxes = () => {
  fireEvent.click(chromosomesCheckbox())
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

// A track config is free to name an assembly by an alias, and the rows Quick
// start hands to Manual go into an assembly Select whose options are the
// session's own names — so an alias was a value matching no option and the row
// came over blank. The rows are the assembly, not the name the track uses.
test('Quick start on an alias-named track hands Manual the assembly itself', () => {
  setup({
    assemblyNames: ['hg38', 'mm39'],
    aliases: { hg38: ['GRCh38'] },
    tracks: [syntenyTrack('aliased', ['GRCh38', 'mm39'])],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Quick start' }))
  expect(screen.getByTestId('quick-start-rows')).toHaveTextContent('1. hg38')
  goManual()
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'mm39'])
})

// Quick start seeds its rows straight from the track's assemblyNames, so a
// track naming an assembly the session has no configuration for put that name
// in a Select that has no such option — it rendered empty — and Launch would
// have built a row whose init fails with "Assembly ghost not found", erroring
// the view. Not launchable, so not a Quick start option, so the session opens
// on the form that can actually do something.
test('a track naming an unloadable assembly does not open Quick start', () => {
  setup({
    assemblyNames: ['hg38', 'mm39'],
    tracks: [syntenyTrack('hg38_ghost', ['hg38', 'ghost'])],
  })
  expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'mm39'])
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
  // the connection's dataset is launchable, so the form now offers Quick start;
  // this is the manual flow, which the toggle still reaches with the rows the
  // user was already looking at
  goManual()
  expect(screen.getByTestId('synbutton')).toHaveAccessibleName(
    /Configure synteny track/,
  )
  fireEvent.click(launchButton())
  expect(levelTrackIds(model)).toEqual([['conn_track']])
})

// The launchable list is empty on the first render of a session whose synteny
// dataset comes from a connection — connect() has not resolved — and the mode
// used to be snapshotted there, so the one dataset the session has was never
// offered in the mode that launches it in a click.
test('a connection that loads after mount still offers Quick start', () => {
  const { loadConnection } = setup({
    assemblyNames: ['hg38', 'mm39'],
    connectionTracks: [syntenyTrack('conn_track', ['hg38', 'mm39'])],
  })
  expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  loadConnection()
  expect(screen.getByRole('button', { name: 'Quick start' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByTestId('quick-start-rows')).toHaveTextContent('1. hg38')
})

// Clicking the button you are already on is how a derived mode gets latched, so
// it reaches the same handler the real switch does — and must not also re-run
// the handover, which resets the rows to the Quick start track's.
test('re-clicking Manual keeps what the manual form already holds', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  goManual()
  pickAssembly(1, 'rn7')
  goManual()
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'rn7'])
})

// nothing loading afterwards moves the form under a user who has picked a mode
test('a mode the user picked survives a connection loading', () => {
  const { loadConnection } = setup({
    assemblyNames: ['hg38', 'mm39'],
    connectionTracks: [syntenyTrack('conn_track', ['hg38', 'mm39'])],
  })
  goManual()
  loadConnection()
  expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

// The rows are hg38/mm39 and the one dataset connects them, so the only
// connected assembly is hg38 — already row 1. Defaulting to it made Add row
// produce hg38/mm39/hg38: the same alignment again, upside down. A row nobody
// has a dataset for yet is the honest answer, and its own broken-link icon says
// so.
test('Add row does not default to an assembly the stack already holds', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  goManual()
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'mm39', 'rn7'])
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

// The default comes from getConnectedAssemblies, which reads the other endpoint
// off every synteny track naming the bottom row — and a track config is free to
// name an assembly the session has no configuration for. Defaulting the row to
// one puts a value in the Select that is not among its options, so the row
// renders blank: the user clicks Add row and gets an unnamed one.
//
// rn7's datasets are the ghost one first and a usable one second, so taking the
// head of the list is exactly what has to be skipped.
test('Add row skips a connected assembly the session cannot open', () => {
  setup({
    // no `ghost` assembly, though a track names one
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [
      syntenyTrack('hg38_mm39', ['hg38', 'mm39']),
      syntenyTrack('rn7_ghost', ['rn7', 'ghost']),
      syntenyTrack('rn7_mm39', ['rn7', 'mm39']),
    ],
  })
  goManual()
  // move the bottom row onto rn7, whose first dataset is the unopenable one
  pickAssembly(1, 'rn7')
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))

  expect(rowSelects().map(s => s.textContent)).toEqual(['hg38', 'rn7', 'mm39'])
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

test('a None does not slide onto a different pair when a row is removed', () => {
  // selections are indexed by pair position but are about a pair of
  // assemblies. Removing row 3 used to splice the list by index, leaving the
  // None chosen for mm39/rn7 sitting on the mm39/panTro6 pair that replaced it
  const { model } = setup({
    assemblyNames: ['hg38', 'mm39', 'rn7', 'panTro6'],
    tracks: [syntenyTrack('mm39_panTro6', ['mm39', 'panTro6'])],
  })
  // the one track opens the form in Quick start on its own two rows, so Manual
  // starts from those and every row is set explicitly here
  goManual()
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  pickAssembly(0, 'hg38')
  pickAssembly(1, 'mm39')
  pickAssembly(2, 'rn7')
  pickAssembly(3, 'panTro6')

  // silence the middle pair, mm39/rn7
  fireEvent.click(screen.getAllByTestId('synbutton')[1]!)
  fireEvent.click(screen.getByRole('radio', { name: 'None' }))
  expect(model.importFormSyntenyTrackSelections[1]).toEqual({ type: 'none' })

  fireEvent.click(screen.getByRole('button', { name: 'Remove row 3' }))
  expect(rowSelects().map(s => s.textContent)).toEqual([
    'hg38',
    'mm39',
    'panTro6',
  ])
  // the silenced pair is gone, so mm39/panTro6 is free to find its own track
  fireEvent.click(launchButton())
  expect(levelTrackIds(model)).toEqual([[], ['mm39_panTro6']])
})

test('changing an assembly releases the pending upload for the old pair', () => {
  // the upload was started for hg38/mm39. Once row 2 is something else it can
  // never be finished for this pair, so leaving it in place only disabled
  // Launch and offered "finish the upload" for a pair that no longer exists
  setup({ assemblyNames: ['hg38', 'mm39', 'rn7'] })
  fireEvent.click(screen.getByRole('radio', { name: 'New track' }))
  expect(launchButton()).toBeDisabled()

  pickAssembly(1, 'rn7')
  expect(launchButton()).toBeEnabled()
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

  // configuring the second pair (mm39/rn7) when the reversal happens
  fireEvent.click(screen.getAllByTestId('synbutton')[1]!)
  expect(pairHeading()).toHaveTextContent('between mm39 and rn7')

  fireEvent.click(screen.getByRole('button', { name: /Reverse the row order/ }))
  expect(rowSelects().map(s => s.textContent)).toEqual(['rn7', 'mm39', 'hg38'])
  // the same adjacencies, so nothing has come unconnected
  expect(
    screen.queryByRole('button', { name: /No synteny dataset connects/ }),
  ).not.toBeInTheDocument()
  // and the panel stays on the pair it was configuring, which is now first.
  // Auto-arrange resets to pair 0 because its new ordering has no
  // correspondence to the old one; a reversal does, so it keeps it.
  expect(pairHeading()).toHaveTextContent('between rn7 and mm39')
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

// One box per row, so the flat form put a field the reader has to decide about
// beside every assembly they picked. The fragmented-assembly case they exist for
// is the rare one, so they are opt-in — the same disclosure the dotplot carries.
test('the chromosome boxes are hidden until asked for', () => {
  setup({ assemblyNames: ['hg38', 'mm39'] })
  expect(
    screen.queryByTestId('chromosome-filter-row-0'),
  ).not.toBeInTheDocument()

  showChromosomeBoxes()
  expect(chromosomeBox(0)).toBeInTheDocument()
  expect(chromosomeBox(1)).toBeInTheDocument()
})

test('a chromosome box reaches that row as its init displayedRegionNames', () => {
  const { model } = setup({ assemblyNames: ['hg38', 'mm39'] })
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox(0), { target: { value: 'ctgA, ctgB' } })
  fireEvent.click(launchButton())
  expect(model.views.map(v => v.pendingLaunch)).toEqual([
    { assembly: 'hg38', displayedRegionNames: ['ctgA', 'ctgB'] },
    // omitted rather than [], which would take the named-regions path with
    // nothing to name
    { assembly: 'mm39' },
  ])
})

test('changing a row assembly drops the chromosomes typed for it', () => {
  // the names were typed about mm39; on rn7 they at best unrestrict the row
  // with a warning, at worst match and stack the wrong thing quietly
  setup({ assemblyNames: ['hg38', 'mm39', 'rn7'] })
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox(0), { target: { value: 'ctgA' } })
  fireEvent.change(chromosomeBox(1), { target: { value: 'ctgB' } })

  pickAssembly(1, 'rn7')
  expect(chromosomeBox(1)).toHaveValue('')
  // the other row is untouched — its assembly did not change
  expect(chromosomeBox(0)).toHaveValue('ctgA')
})

test('removing a row carries the rows below it along with their text', () => {
  // every row below the removal shifts up, so matching on position alone
  // silently dropped what the user had typed on all of them
  setup({ assemblyNames: ['hg38', 'mm39', 'rn7'] })
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  pickAssembly(2, 'rn7')
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox(1), { target: { value: 'ctgA' } })
  fireEvent.change(chromosomeBox(2), { target: { value: 'ctgB' } })

  fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }))
  expect(rowSelects().map(s => s.textContent)).toEqual(['mm39', 'rn7'])
  expect(chromosomeBox(0)).toHaveValue('ctgA')
  expect(chromosomeBox(1)).toHaveValue('ctgB')
})

// Hiding has to CLEAR, or a stack comes back restricted by a box that is no
// longer on screen — the one failure the disclosure can introduce.
test('hiding the boxes clears what was typed in them', () => {
  const { model } = setup({ assemblyNames: ['hg38', 'mm39'] })
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox(0), { target: { value: 'ctgA' } })

  fireEvent.click(chromosomesCheckbox())
  fireEvent.click(launchButton())
  expect(model.views.map(v => v.pendingLaunch)).toEqual([
    { assembly: 'hg38' },
    { assembly: 'mm39' },
  ])
})

// A plugin's own option stores a plain `none`, so rebuilding the radio from the
// stored selection reads it back as "None" — and once the plugin writes the
// track it built, as "New track". Either way the panel came back on a built-in
// radio the moment the user visited another pair, which is why the choice is
// held by the form and keyed by the pair's assemblies.
const contributeServerOption = (pluginManager: PluginManager) => {
  pluginManager.contributeToExtensionPoint(
    'LinearSyntenyView-ImportFormSyntenyOptions',
    () => ({
      value: 'my-server',
      label: 'Load from my server',
      ReactComponent: () => <div data-testid="my-server-panel" />,
    }),
  )
}

const serverRadio = () =>
  screen.getByRole('radio', { name: 'Load from my server' })

test('a plugin option survives a visit to another pair', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    contribute: contributeServerOption,
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  pickAssembly(2, 'rn7')

  fireEvent.click(screen.getAllByTestId('synbutton')[0]!)
  fireEvent.click(serverRadio())
  expect(screen.getByTestId('my-server-panel')).toBeInTheDocument()

  fireEvent.click(screen.getAllByTestId('synbutton')[1]!)
  expect(screen.queryByTestId('my-server-panel')).not.toBeInTheDocument()

  fireEvent.click(screen.getAllByTestId('synbutton')[0]!)
  expect(serverRadio()).toBeChecked()
  expect(screen.getByTestId('my-server-panel')).toBeInTheDocument()
})

// keyed by the pair's assemblies, the same rule remapSelectionsToPairs matches
// selections by, so the two move together instead of one being stranded
test('a plugin option follows its pair when the rows are reversed', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    contribute: contributeServerOption,
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  pickAssembly(2, 'rn7')
  fireEvent.click(screen.getAllByTestId('synbutton')[0]!)
  fireEvent.click(serverRadio())

  fireEvent.click(screen.getByRole('button', { name: /Reverse the row order/ }))
  // hg38/mm39 is now the bottom pair, and the arrow followed it there
  expect(rowSelects().map(s => s.textContent)).toEqual(['rn7', 'mm39', 'hg38'])
  expect(serverRadio()).toBeChecked()
})

// One assembly carrying both haplotypes, three rows of it — the shape the
// HG002 tutorial's dataset takes — so every band is the same assembly set and
// nothing tells the bands apart but their position. Both halves of matching a
// band to what was configured for it used to collapse here: the selection remap
// only pooled the pairs that HELD one, so the lower band's was the first thing
// the upper band claimed, and the radio was keyed by the pair's assemblies,
// which every band shares.
test('a self-alignment stack keeps each band’s own configuration', () => {
  setup({ assemblyNames: ['hg002'], contribute: contributeServerOption })
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  expect(rowSelects().map(s => s.textContent)).toEqual([
    'hg002',
    'hg002',
    'hg002',
  ])

  // the LOWER band only
  fireEvent.click(screen.getAllByTestId('synbutton')[1]!)
  fireEvent.click(serverRadio())

  fireEvent.click(screen.getAllByTestId('synbutton')[0]!)
  expect(serverRadio()).not.toBeChecked()

  // the rows are identical, so reversing them changes nothing about which band
  // is which
  fireEvent.click(screen.getByRole('button', { name: /Reverse the row order/ }))
  fireEvent.click(screen.getAllByTestId('synbutton')[1]!)
  expect(serverRadio()).toBeChecked()
  fireEvent.click(screen.getAllByTestId('synbutton')[0]!)
  expect(serverRadio()).not.toBeChecked()
})

test('a pair the option was never chosen for keeps the built-in default', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    contribute: contributeServerOption,
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  pickAssembly(2, 'rn7')
  fireEvent.click(screen.getAllByTestId('synbutton')[0]!)
  fireEvent.click(serverRadio())

  fireEvent.click(screen.getAllByTestId('synbutton')[1]!)
  expect(serverRadio()).not.toBeChecked()
  expect(screen.getByRole('radio', { name: 'Existing track' })).toBeChecked()
})

test('a session with no assemblies cannot launch, and says why', () => {
  // launching blank rows errored the view with "init needs an assembly"
  setup({ assemblyNames: [] })
  expect(launchButton()).toBeDisabled()
  expect(
    screen.getByText('This session has no configured assemblies to open.'),
  ).toBeInTheDocument()
})

test('an assembly added after mount seeds the rows', () => {
  const { session } = setup({ assemblyNames: [] })
  act(() => {
    session.addAssembly({
      name: 'late',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'late_refseq',
        adapter: { type: 'FromConfigSequenceAdapter', features: [] },
      },
    })
  })
  expect(rowSelects().map(s => s.textContent)).toEqual(['late', 'late'])
  expect(launchButton()).toBeEnabled()
})

test('every pair with an unfinished upload is named next to Launch', () => {
  setup({ assemblyNames: ['hg38', 'mm39', 'rn7'] })
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  fireEvent.click(screen.getByRole('radio', { name: 'New track' }))
  fireEvent.click(screen.getAllByTestId('synbutton')[0]!)
  fireEvent.click(screen.getByRole('radio', { name: 'New track' }))
  expect(launchButton()).toBeDisabled()
  expect(
    screen.getByText(
      'Finish the new synteny track between rows 1 and 2, and between rows 2 and 3, or set that pair to None.',
    ),
  ).toBeInTheDocument()
})
