import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'

import DotplotImportForm from './index.tsx'

import type { DotplotViewModel } from '../../model.ts'

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

const goManual = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Manual' }))
}

test('an empty session opens on Manual, since Quick start has nothing to launch', () => {
  setup()
  expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Manual is the form that can actually do something with no tracks
  expect(axisSelect('X')).toBeInTheDocument()
  expect(axisSelect('Y')).toBeInTheDocument()
})

test('a session with a synteny track opens on Quick start naming both axes', () => {
  setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  const axes = screen.getByTestId('quick-start-axes')
  // a track's assemblyNames are [query, target] = [y, x]
  expect(axes).toHaveTextContent('X-axis: mm39')
  expect(axes).toHaveTextContent('Y-axis: hg38')
})

test('Swap puts each assembly on the other axis', () => {
  setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  fireEvent.click(
    screen.getByRole('button', { name: /Put each assembly on the other axis/ }),
  )
  const axes = screen.getByTestId('quick-start-axes')
  expect(axes).toHaveTextContent('X-axis: hg38')
  expect(axes).toHaveTextContent('Y-axis: mm39')
})

test('Quick start launch sets the axes and shows the track', () => {
  const { model } = setup({
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  fireEvent.click(launchButton())
  expect(model.assemblyNames).toEqual(['mm39', 'hg38'])
  expect(model.tracks.map(t => t.configuration.trackId)).toEqual(['hg38_mm39'])
})

test('an all-vs-all track says which assemblies a dotplot leaves out', () => {
  setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('all', ['hg38', 'mm39', 'rn7'])],
  })
  expect(screen.getByText(/This track spans 3 assemblies/)).toBeInTheDocument()
})

test('Manual opens on two different assemblies, not the same one twice', () => {
  // both axes on one assembly would open on an empty track picker. This is the
  // opens-directly-in-Manual case; with a track present the form opens in Quick
  // start and switching hands over that track's axes instead.
  setup({ assemblyNames: ['hg38', 'mm39'] })
  expect(axisSelect('X')).toHaveTextContent('hg38')
  expect(axisSelect('Y')).toHaveTextContent('mm39')
})

test('switching to Manual hands over the axes Quick start had set up', () => {
  setup({ tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])] })
  goManual()
  // [query, target] = [y, x], so the track's first assembly lands on y
  expect(axisSelect('X')).toHaveTextContent('mm39')
  expect(axisSelect('Y')).toHaveTextContent('hg38')
})

test('Manual launch sets the axes the user picked, x first', () => {
  const { model } = setup({ assemblyNames: ['hg38', 'mm39'] })
  fireEvent.click(launchButton())
  expect(model.assemblyNames).toEqual(['hg38', 'mm39'])
})

test('the track picker offers a connection-supplied synteny track', () => {
  const { loadConnection } = setup({
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

test('a same-assembly pair names the self-alignment case', () => {
  setup({ assemblyNames: ['hg38', 'mm39'] })
  // MUI's Select opens its menu on mouseDown, not click
  fireEvent.mouseDown(axisSelect('Y'))
  fireEvent.click(screen.getByRole('option', { name: 'hg38' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Existing track' }))
  expect(
    screen.getByText(/no self-alignment synteny track references it twice/),
  ).toBeInTheDocument()
})

test('None leaves the launch without a track', () => {
  const { model } = setup({
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  goManual()
  fireEvent.click(screen.getByRole('radio', { name: 'None' }))
  fireEvent.click(launchButton())
  expect(model.assemblyNames).toEqual(['mm39', 'hg38'])
  expect(model.tracks).toHaveLength(0)
})
