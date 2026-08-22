import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSessionAsync } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'

import DotplotImportForm from './index.tsx'

import type { DotplotViewModel } from '../../model.ts'

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

async function setup({
  assemblyNames = ['hg38', 'mm39'],
  aliases = {},
  tracks = [],
  connectionTracks,
}: {
  assemblyNames?: string[]
  // other names for an assembly, which a track config is free to use
  aliases?: Record<string, string[]>
  tracks?: ReturnType<typeof syntenyTrack>[]
  // tracks a connection supplies, which live outside session.tracks
  connectionTracks?: ReturnType<typeof syntenyTrack>[]
} = {}) {
  const session = await createTestSessionAsync({
    jbrowseConfig: {
      assemblies: assemblyNames.map(name => assembly(name, aliases[name])),
      tracks,
      connections: connectionTracks
        ? [{ type: 'JBrowse1Connection', connectionId: 'conn', name: 'conn' }]
        : [],
    },
    // no assemblyNames on the view, which is what puts it on the import form
    sessionSnapshot: {
      views: [{ id: 'dotplotview', type: 'DotplotView' }],
    },
  })
  const model = session.views[0] as unknown as DotplotViewModel
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DotplotImportForm model={model} />
    </ThemeProvider>,
  )
  return {
    model,
    session,
    // brings the connection up and hands it its tracks, inside act so React sees
    // the observable change. The conf is hydrated from config, so it is a real
    // configuration model rather than a plain snapshot.
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
        const conn = session.makeConnection(session.connections[0]!)
        conn.addTrackConfs(connectionTracks ?? [])
      })
    },
    ...utils,
  }
}

const launchButton = () => screen.getByRole('button', { name: 'Launch' })

const axisSelect = (axis: 'X' | 'Y') =>
  screen.getByRole('combobox', { name: `${axis}-axis assembly` })

// by testid, not by label: both boxes share a placeholder, and the testid is
// what ChromosomeFilter puts on the input for exactly this
const chromosomeBox = (axis: 'x' | 'y') =>
  screen.getByTestId(`chromosome-filter-${axis}`)

// The boxes are off until asked for, so anything about what goes IN them opens
// them first.
const chromosomesCheckbox = () =>
  screen.getByRole('checkbox', { name: 'Plot only certain chromosomes' })

const showChromosomeBoxes = () => {
  fireEvent.click(chromosomesCheckbox())
}

const goManual = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Manual' }))
}

test('an empty session opens on Manual, since Quick start has nothing to launch', async () => {
  await setup()
  expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Manual is the form that can actually do something with no tracks
  expect(axisSelect('X')).toBeInTheDocument()
  expect(axisSelect('Y')).toBeInTheDocument()
})

test('a session with a synteny track opens on Quick start naming both axes', async () => {
  await setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  const axes = screen.getByTestId('quick-start-axes')
  // a track's assemblyNames are [query, target] = [y, x]
  expect(axes).toHaveTextContent('X-axis: mm39')
  expect(axes).toHaveTextContent('Y-axis: hg38')
})

// The axes come from the track's rows, which go into an AssemblySelector on
// handover and into assembly1/assembly2 on Launch — both of which want the
// session's own name for the assembly, not whichever name the track uses.
test('an alias-named track names its axes by the assembly', async () => {
  await setup({
    aliases: { hg38: ['GRCh38'] },
    tracks: [syntenyTrack('aliased', ['GRCh38', 'mm39'])],
  })
  const axes = screen.getByTestId('quick-start-axes')
  expect(axes).toHaveTextContent('X-axis: mm39')
  expect(axes).toHaveTextContent('Y-axis: hg38')
})

test('Swap puts each assembly on the other axis', async () => {
  await setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  fireEvent.click(
    screen.getByRole('button', { name: /Put each assembly on the other axis/ }),
  )
  const axes = screen.getByTestId('quick-start-axes')
  expect(axes).toHaveTextContent('X-axis: hg38')
  expect(axes).toHaveTextContent('Y-axis: mm39')
})

test('Quick start launch sets the axes and shows the track', async () => {
  const { model } = await setup({
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  fireEvent.click(launchButton())
  expect(model.assemblyNames).toEqual(['mm39', 'hg38'])
  expect(model.tracks.map(t => t.configuration.trackId)).toEqual(['hg38_mm39'])
})

test('an all-vs-all track says which assemblies a dotplot leaves out', async () => {
  await setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('all', ['hg38', 'mm39', 'rn7'])],
  })
  expect(screen.getByText(/This track spans 3 assemblies/)).toBeInTheDocument()
})

test('Swap on an all-vs-all track transposes the pair, not which pair', async () => {
  // Swap used to reverse the row list, so on a 3-assembly track it swapped in
  // rn7 and dropped hg38 — a different pair, not the transpose of this one
  await setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('all', ['hg38', 'mm39', 'rn7'])],
  })
  fireEvent.click(
    screen.getByRole('button', { name: /Put each assembly on the other axis/ }),
  )
  const axes = screen.getByTestId('quick-start-axes')
  expect(axes).toHaveTextContent('X-axis: hg38')
  expect(axes).toHaveTextContent('Y-axis: mm39')
})

test('Manual opens on two different assemblies, not the same one twice', async () => {
  // both axes on one assembly would open on an empty track picker. This is the
  // opens-directly-in-Manual case; with a track present the form opens in Quick
  // start and switching hands over that track's axes instead.
  await setup({ assemblyNames: ['hg38', 'mm39'] })
  expect(axisSelect('X')).toHaveTextContent('hg38')
  expect(axisSelect('Y')).toHaveTextContent('mm39')
})

test('switching to Manual hands over the axes Quick start had set up', async () => {
  await setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  goManual()
  // [query, target] = [y, x], so the track's first assembly lands on y
  expect(axisSelect('X')).toHaveTextContent('mm39')
  expect(axisSelect('Y')).toHaveTextContent('hg38')
})

test('Manual launch sets the axes the user picked, x first', async () => {
  const { model } = await setup({ assemblyNames: ['hg38', 'mm39'] })
  fireEvent.click(launchButton())
  expect(model.assemblyNames).toEqual(['hg38', 'mm39'])
})

test('the chromosome box reaches the init as that axis displayedRegionNames', async () => {
  const { model } = await setup({ assemblyNames: ['hg38', 'mm39'] })
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox('x'), { target: { value: 'ctgA, ctgB' } })
  fireEvent.click(launchButton())
  expect(model.init).toEqual({
    views: [
      { assembly: 'hg38', displayedRegionNames: ['ctgA', 'ctgB'] },
      { assembly: 'mm39', displayedRegionNames: [] },
    ],
  })
})

test('changing an axis assembly drops the chromosomes typed for it', async () => {
  // the names were typed about hg38; on rn7 they are at best unrestricting the
  // axis with a warning, at worst plotting the wrong thing quietly
  await setup({ assemblyNames: ['hg38', 'mm39', 'rn7'] })
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox('x'), { target: { value: 'ctgA' } })
  fireEvent.change(chromosomeBox('y'), { target: { value: 'ctgB' } })
  fireEvent.mouseDown(axisSelect('X'))
  fireEvent.click(screen.getByRole('option', { name: 'rn7' }))
  expect(chromosomeBox('x')).toHaveValue('')
  // the other axis is untouched — its assembly did not change
  expect(chromosomeBox('y')).toHaveValue('ctgB')
})

test('switching to Manual drops chromosomes typed against the axes it replaces', async () => {
  await setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  goManual()
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox('x'), { target: { value: 'ctgA' } })
  // back to Quick start and in again: the handover re-seats both axes, so what
  // was typed against the previous pair does not survive it
  fireEvent.click(screen.getByRole('button', { name: 'Quick start' }))
  goManual()
  expect(chromosomeBox('x')).toHaveValue('')
})

// The boxes are the fragmented-assembly case and every other form opens without
// them, so they are off unless asked for.
test('the chromosome boxes are hidden until asked for', async () => {
  await setup({ assemblyNames: ['hg38', 'mm39'] })
  expect(screen.queryByTestId('chromosome-filter-x')).not.toBeInTheDocument()
  expect(screen.queryByTestId('chromosome-filter-y')).not.toBeInTheDocument()

  showChromosomeBoxes()
  expect(chromosomeBox('x')).toBeInTheDocument()
  expect(chromosomeBox('y')).toBeInTheDocument()
})

// Hiding has to CLEAR, or a plot comes back restricted by names typed into a
// box that is no longer on screen — the one failure a disclosure can introduce
// that the flat form could not.
test('hiding the boxes clears what was typed in them', async () => {
  const { model } = await setup({ assemblyNames: ['hg38', 'mm39'] })
  showChromosomeBoxes()
  fireEvent.change(chromosomeBox('x'), { target: { value: 'ctgA' } })
  fireEvent.change(chromosomeBox('y'), { target: { value: 'ctgB' } })

  fireEvent.click(chromosomesCheckbox())
  fireEvent.click(launchButton())
  // no init at all, which is doSubmit's "neither box was used" — an init
  // carrying two empty lists would be a restriction request that resolves to
  // nothing
  expect(model.init).toBeUndefined()
})

test('the track picker offers a connection-supplied synteny track', async () => {
  const { loadConnection } = await setup({
    assemblyNames: ['hg38', 'mm39'],
    connectionTracks: [syntenyTrack('conn_track', ['hg38', 'mm39'])],
  })
  fireEvent.click(screen.getByRole('radio', { name: 'Existing track' }))
  expect(
    screen.getByText(/No pre-configured synteny track connects/),
  ).toBeInTheDocument()

  loadConnection()
  expect(
    screen.queryByText(/No pre-configured synteny track connects/),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('combobox', { name: 'Synteny track' }),
  ).toHaveTextContent('conn_track')
})

test('a same-assembly pair names the self-alignment case', async () => {
  await setup({ assemblyNames: ['hg38', 'mm39'] })
  // MUI's Select opens its menu on mouseDown, not click
  fireEvent.mouseDown(axisSelect('Y'))
  fireEvent.click(screen.getByRole('option', { name: 'hg38' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Existing track' }))
  expect(
    screen.getByText(/no self-alignment synteny track references it twice/),
  ).toBeInTheDocument()
})

test('an unfinished new-track upload blocks launch', async () => {
  // picking "New track" starts an upload with no file yet. Launching would
  // resolve to no action and open an empty dotplot with nothing saying why,
  // which is the same case the synteny import form refuses.
  await setup({ assemblyNames: ['hg38', 'mm39'] })
  fireEvent.click(screen.getByRole('radio', { name: 'New track' }))
  expect(launchButton()).toBeDisabled()
  expect(screen.getByText(/new synteny track is unfinished/)).toBeVisible()

  // clearing it back to None makes the trackless launch available again
  fireEvent.click(screen.getByRole('radio', { name: 'None' }))
  expect(launchButton()).toBeEnabled()
})

test('changing an axis releases the pending upload for the old pair', async () => {
  // the upload was started for hg38/mm39. Once the y-axis is something else it
  // can never be finished for this pair, so leaving it in place only disables
  // Launch and offers "choose a file" for a pair that no longer exists
  await setup({ assemblyNames: ['hg38', 'mm39', 'rn7'] })
  fireEvent.click(screen.getByRole('radio', { name: 'New track' }))
  expect(launchButton()).toBeDisabled()

  fireEvent.mouseDown(axisSelect('Y'))
  fireEvent.click(screen.getByRole('option', { name: 'rn7' }))
  expect(launchButton()).toBeEnabled()
})

test('a None does not carry onto a pair the user never silenced', async () => {
  const { model } = await setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [
      syntenyTrack('hg38_mm39', ['hg38', 'mm39']),
      syntenyTrack('hg38_rn7', ['hg38', 'rn7']),
    ],
  })
  goManual()
  fireEvent.click(screen.getByRole('radio', { name: 'None' }))

  // a different pair, which is free to find its own track
  fireEvent.mouseDown(axisSelect('X'))
  fireEvent.click(screen.getByRole('option', { name: 'rn7' }))
  fireEvent.click(launchButton())
  expect(model.tracks).toHaveLength(1)
})

test('None leaves the launch without a track', async () => {
  const { model } = await setup({
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  goManual()
  fireEvent.click(screen.getByRole('radio', { name: 'None' }))
  fireEvent.click(launchButton())
  expect(model.assemblyNames).toEqual(['mm39', 'hg38'])
  expect(model.tracks).toHaveLength(0)
})
