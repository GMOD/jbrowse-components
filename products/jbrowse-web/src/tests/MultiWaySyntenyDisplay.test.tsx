import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import configSnapshot from '../../test_data/multiway_blocks/config.json' with { type: 'json' }
import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

import type { MultiWaySyntenyDisplayModel } from '@jbrowse/plugin-linear-comparative-view'
import type { GenericFilehandle } from 'generic-filehandle2'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

function multiwayGetFile(url: string): GenericFilehandle {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/multiway_blocks/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

utilizeFetchMockForTest(multiwayGetFile)

test('MultiWaySyntenyDisplay fetches and groups a multi-genome blocks track in a plain LGV', async () => {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: ['multiway_blocks'],
    },
  })
  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
      expect(view.tracks.length).toBe(1)
    },
    { timeout: 30000 },
  )

  const display = view.tracks[0]!.displays[0] as MultiWaySyntenyDisplayModel
  expect(display.type).toBe('MultiWaySyntenyDisplay')

  await waitFor(
    () => {
      expect(display.groups.length).toBe(4)
    },
    { timeout: 30000 },
  )

  expect(display.groups.map(g => g.name)).toEqual(['g1', 'g2', 'g3', 'g4'])
  expect(display.rowAssemblies).toEqual(['peach', 'cacao'])
  const g1 = display.groups[0]!
  expect(g1.mates.get('peach')).toHaveLength(1)
  expect(g1.mates.get('cacao')).toHaveLength(1)
  const g2 = display.groups[1]!
  expect(g2.mates.has('cacao')).toBe(false)
  expect(display.painted).toBe(true)

  await waitFor(
    () => {
      expect(display.laneGenes?.get('grape')?.length).toBe(2)
    },
    { timeout: 30000 },
  )
  const gene = display
    .laneGenes!.get('grape')!
    .find(f => f.get('name') === 'g1')!
  const exons = gene
    .get('subfeatures')![0]!
    .get('subfeatures')!
    .filter(f => f.get('type') === 'exon')
  expect(exons.map(f => [f.get('start'), f.get('end')])).toEqual([
    [100, 130],
    [170, 200],
  ])

  expect(
    display
      .trackMenuItems()
      .flatMap(item => ('label' in item ? [item.label] : [])),
  ).toContain('Launch stacked synteny view (visible region)')
}, 40000)
