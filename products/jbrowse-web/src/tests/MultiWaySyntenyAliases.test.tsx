import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import baseConfig from '../../test_data/multiway_blocks/config.json' with { type: 'json' }
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

interface JsonRecord {
  [key: string]: unknown
}

function clone(): {
  assemblies: JsonRecord[]
  tracks: JsonRecord[]
} {
  return JSON.parse(JSON.stringify(baseConfig)) as {
    assemblies: JsonRecord[]
    tracks: JsonRecord[]
  }
}

function assemblyNamed(config: ReturnType<typeof clone>, name: string) {
  return config.assemblies.find(a => a.name === name)!
}

async function openDisplay(
  config: ReturnType<typeof clone>,
  trackId: string,
): Promise<MultiWaySyntenyDisplayModel> {
  const { rootModel } = await getPluginManager(config)
  rootModel.setDefaultSession()
  const view = rootModel.session!.addView('LinearGenomeView', {
    assembly: 'grape',
    loc: 'chr1:1-1000',
    tracks: [trackId],
  })
  view.setWidth(800)
  return await waitFor(
    () => {
      const display = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(display?.groups.length).toBe(4)
      return display!
    },
    { timeout: 30000 },
  )
}

// A lane's annotation is found by matching a track config's `assemblyNames`
// against the lane, and its gene models then arrive spelled the way that
// assembly's GFF3 spells its sequences — which is not how the synteny table's
// BED spells them. Both comparisons used `===`, and both sides of this fixture
// are what the alias tables exist for: the peach track is declared against
// `Prunus_persica` while the session opened `peach`, and peach's GFF3 names its
// sequence `CM000001.1` where the BED (and so the lane frame) says `Pp1`.
test('a lane finds an annotation declared under an alias and draws it', async () => {
  const config = clone()
  const peach = assemblyNamed(config, 'peach')
  peach.aliases = ['Prunus_persica']
  peach.refNameAliases = {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: {
        uri: 'peach.chromAlias.txt',
        locationType: 'UriLocation',
      },
    },
  }
  config.tracks.push({
    type: 'FeatureTrack',
    trackId: 'peach_genes',
    name: 'peach genes',
    assemblyNames: ['Prunus_persica'],
    adapter: {
      type: 'Gff3Adapter',
      gffLocation: {
        uri: 'peach_genes.gff3',
        locationType: 'UriLocation',
      },
    },
  })

  const display = await openDisplay(config, 'multiway_blocks')

  // the config side: `Prunus_persica` is peach
  expect(display.laneGeneAdapters.has('peach')).toBe(true)

  await waitFor(
    () => {
      expect(display.laneGenes?.get('peach')?.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
  expect(
    display.laneGenes!.get('peach')!.map(g => g.feature.get('refName')),
  ).toEqual(['CM000001.1', 'CM000001.1'])
  expect(display.rowFrames.get('peach')!.refName).toBe('Pp1')

  // the drawn side: those genes reach the lane rather than being filtered out
  // by a refName comparison across two files
  const drawn = [...display.laneGlyphCells.values()].flatMap(cell =>
    cell.kind === 'glyphs' ? cell.data.hits.map(h => h.label) : [],
  )
  expect(drawn).toContain('p1')
  expect(drawn).toContain('p2')
}, 40000)

// A blocks table is free to name one genome in two columns (the wheat
// homoeolog shape), and a column spelling the anchor as an alias is still the
// anchor: its records draw on the anchor's own axis and must not stack up a
// redundant lane of the anchor against itself.
test('a mate column spelling the anchor as an alias gets no lane of its own', async () => {
  const config = clone()
  assemblyNamed(config, 'grape').aliases = ['Vvin']
  config.tracks.push({
    type: 'SyntenyTrack',
    trackId: 'multiway_blocks_self',
    name: 'grape/grape/peach/cacao blocks',
    assemblyNames: ['grape', 'Vvin', 'peach', 'cacao'],
    adapter: {
      type: 'MCScanBlocksAdapter',
      mcscanBlocksLocation: {
        uri: 'grape_self.blocks',
        locationType: 'UriLocation',
      },
      blockAssemblies: ['grape', 'Vvin', 'peach', 'cacao'],
      bedLocations: [
        { uri: 'grape.bed', locationType: 'UriLocation' },
        { uri: 'grape.bed', locationType: 'UriLocation' },
        { uri: 'peach.bed', locationType: 'UriLocation' },
        { uri: 'cacao.bed', locationType: 'UriLocation' },
      ],
      assemblyNames: ['grape', 'Vvin', 'peach', 'cacao'],
    },
    displays: [
      {
        type: 'MultiWaySyntenyDisplay',
        displayId: 'multiway_blocks_self-MultiWaySyntenyDisplay',
      },
    ],
  })

  const display = await openDisplay(config, 'multiway_blocks_self')

  // the table really does carry the anchor-as-alias placements
  expect(display.groups[0]!.mates.get('Vvin')).toHaveLength(1)
  expect(display.rowAssemblies).toEqual(['peach', 'cacao'])
}, 40000)
