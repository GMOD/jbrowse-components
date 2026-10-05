/**
 * @jest-environment jsdom
 */
import { getEnv } from '@jbrowse/core/util'
import { createViewStateAsync } from '@jbrowse/react-app2'

import {
  buildDisplaySnapshot,
  categorizedDisplayTypes,
  trackCategory,
} from './applyTrackOpts.ts'
import { trackTypes } from './makeConfigs.ts'
import { readData } from './readData.ts'

const uri = (name: string) => ({ uri: `https://example.com/${name}` })

const hosted = [
  {
    trackId: 'gc',
    type: 'GCContentTrack',
    name: 'GC',
    assemblyNames: ['a'],
    adapter: {
      type: 'GCContentAdapter',
      sequenceAdapter: {
        type: 'IndexedFastaAdapter',
        fastaLocation: uri('a.fa'),
        faiLocation: uri('a.fa.fai'),
      },
    },
  },
  {
    trackId: 'gwas',
    type: 'GWASTrack',
    name: 'GWAS',
    assemblyNames: ['a'],
    adapter: {
      type: 'GWASAdapter',
      scoreColumn: 'neg_log_pvalue',
      bedGzLocation: uri('g.gz'),
      index: { location: uri('g.gz.tbi') },
    },
  },
  {
    trackId: 'maf',
    type: 'MafTrack',
    name: 'MAF',
    assemblyNames: ['a'],
    adapter: {
      type: 'BgzipTaffyAdapter',
      tafGzLocation: uri('m.taf.gz'),
      taiLocation: uri('m.taf.gz.tai'),
    },
  },
  {
    trackId: 'ld',
    type: 'LDTrack',
    name: 'LD',
    assemblyNames: ['a'],
    adapter: {
      type: 'PlinkLDTabixAdapter',
      uri: 'https://example.com/l.ld.gz',
    },
  },
]

async function makeSession() {
  const files = readData({
    fasta: '/ref.fa',
    trackList: trackTypes.map(flag => [
      flag,
      [flag === 'multiwig' ? 'a.bw,b.bw' : `input.${flag}`],
    ]),
  })
  const model = await createViewStateAsync({
    config: {
      assemblies: files.assemblies,
      tracks: [...files.tracks, ...hosted],
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  return model.session
}

test('every registered display type has a category', async () => {
  const { pluginManager } = getEnv(await makeSession())
  const registered = [...pluginManager.getElementTypesInGroup('display')].map(
    (d: { name: string }) => d.name,
  )
  expect(registered.length).toBeGreaterThan(10)
  expect(
    registered.filter(name => !categorizedDisplayTypes.includes(name)),
  ).toEqual([])
}, 60000)

test('a track takes the category of the display it opens as', async () => {
  const session = await makeSession()
  const of = (trackId: string, opts: string[] = []) =>
    trackCategory(session, trackId, opts)
  expect({
    bam: of('input.bam'),
    cram: of('input.cram'),
    bigwig: of('input.bigwig'),
    multiwig: of('a.bw,b.bw'),
    vcfgz: of('input.vcfgz'),
    gffgz: of('input.gffgz'),
    bigbed: of('input.bigbed'),
    bedgz: of('input.bedgz'),
    hic: of('input.hic'),
    gc: of('gc'),
    gwas: of('gwas'),
    maf: of('maf'),
    ld: of('ld'),
  }).toEqual({
    bam: 'alignments',
    cram: 'alignments',
    bigwig: 'wiggle',
    multiwig: 'wiggle',
    vcfgz: 'variant',
    gffgz: 'feature',
    bigbed: 'feature',
    bedgz: 'feature',
    hic: 'hic',
    gc: 'wiggle',
    gwas: 'other',
    maf: 'other',
    ld: 'other',
  })
}, 60000)

test('display: moves a track to the category of the display it asks for', async () => {
  const session = await makeSession()
  expect(trackCategory(session, 'input.bigwig', ['display:marks'])).toBe(
    'other',
  )
  expect(trackCategory(session, 'input.vcfgz', ['display:multivariant'])).toBe(
    'variant',
  )
  expect(trackCategory(session, 'input.bam', ['display:Nonexistent'])).toBe(
    'other',
  )
}, 60000)

test('an unknown trackId is other', async () => {
  expect(trackCategory(await makeSession(), 'nope', [])).toBe('other')
}, 60000)

describe('a track whose display no translating modifier targets', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  afterEach(() => {
    warn.mockClear()
  })

  test.each(['heightMode:fit', 'featureHeight:compact', 'sashimi:up'])(
    '%s warns and writes nothing',
    opt => {
      expect(buildDisplaySnapshot('other', [opt]).snap).toEqual({})
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('has no effect on this track type'),
      )
    },
  )

  test('height, force and a constant color still apply', () => {
    expect(
      buildDisplaySnapshot('other', ['height:200', 'force', 'color:strand'])
        .snap,
    ).toEqual({ height: 200, forceLoad: true, color: 'strand' })
  })
})
