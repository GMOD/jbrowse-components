import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSessionAsync } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, within } from '@testing-library/react'

import CircularImportForm from './index.tsx'

import type { CircularViewModel } from '../../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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

async function setup({
  assemblyNames = ['hg38', 'mm39'],
  tracks = [],
}: {
  assemblyNames?: string[]
  tracks?: ReturnType<typeof syntenyTrack>[]
} = {}) {
  const session = await createTestSessionAsync({
    jbrowseConfig: {
      assemblies: assemblyNames.map(assembly),
      tracks,
    },
    sessionSnapshot: {
      views: [{ id: 'circular', type: 'CircularView' }],
    },
  })
  const model = session.views[0] as unknown as CircularViewModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CircularImportForm model={model} />
    </ThemeProvider>,
  )
  return { model }
}

const launchButton = () => screen.getByRole('button', { name: 'Launch' })

const rowSelect = (label: string) =>
  screen.getByRole('combobox', { name: label })

test('a session with no synteny track opens on one assembly and launches it', async () => {
  const { model } = await setup()
  expect(rowSelect('Assembly')).toHaveTextContent('hg38')
  expect(
    screen.queryByRole('combobox', { name: 'Second assembly' }),
  ).not.toBeInTheDocument()

  fireEvent.click(launchButton())
  expect(model.pendingLaunch).toEqual({ assembly: ['hg38'] })
})

test('Quick start opens both genomes of a synteny track, reordered', async () => {
  const { model } = await setup({
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  expect(screen.getByTestId('quick-start-circle')).toHaveTextContent(
    'hg38, then mm39 mirrored after it',
  )

  fireEvent.click(launchButton())
  expect(model.pendingLaunch).toEqual({
    assembly: ['hg38', 'mm39'],
    tracks: ['hg38_mm39'],
    autoDiagonalize: true,
  })
})

test('Swap changes which genome starts the circle', async () => {
  const { model } = await setup({
    tracks: [syntenyTrack('hg38_mm39', ['hg38', 'mm39'])],
  })
  fireEvent.click(screen.getByRole('button', { name: /Swap/ }))
  fireEvent.click(launchButton())
  expect(model.pendingLaunch?.assembly).toEqual(['mm39', 'hg38'])
})

// the repeat is what makes a self-alignment launchable at all, and it is one
// arc on the circle, with nothing to reorder
test('a self-alignment track opens one genome with its ribbons', async () => {
  const { model } = await setup({
    tracks: [syntenyTrack('hg38_self', ['hg38', 'hg38'])],
  })
  expect(screen.getByTestId('quick-start-circle')).toHaveTextContent(
    'hg38, aligned to itself',
  )
  fireEvent.click(launchButton())
  expect(model.pendingLaunch).toEqual({
    assembly: ['hg38'],
    tracks: ['hg38_self'],
  })
})

test('Manual restricts each genome by its own chromosome box', async () => {
  const { model } = await setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('hg38_rn7', ['hg38', 'rn7'])],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Manual' }))
  expect(rowSelect('Second assembly')).toHaveTextContent('rn7')

  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Show only certain chromosomes' }),
  )
  fireEvent.change(screen.getByTestId('chromosome-filter-1'), {
    target: { value: 'ctgA' },
  })
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: "Reorder the second genome's chromosomes to follow the first",
    }),
  )
  fireEvent.click(launchButton())
  expect(model.pendingLaunch).toEqual({
    assembly: ['hg38', 'rn7'],
    displayedRegionNames: { rn7: ['ctgA'] },
    tracks: ['hg38_rn7'],
  })
})

// the second assembly defaults to one a synteny track connects to the first,
// which is what makes "Add" produce ribbons rather than two bare arcs
test('Add a second assembly picks a connected one and offers its tracks', async () => {
  await setup({
    assemblyNames: ['hg38', 'mm39', 'rn7'],
    tracks: [syntenyTrack('hg38_rn7', ['hg38', 'rn7'])],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Manual' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove the second assembly' }),
  )
  expect(
    screen.queryByRole('combobox', { name: 'Second assembly' }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Add a second assembly' }))
  expect(rowSelect('Second assembly')).toHaveTextContent('rn7')
  expect(
    within(screen.getByTestId('import-form')).getByRole('radio', {
      name: 'Existing track',
    }),
  ).toBeChecked()
})
