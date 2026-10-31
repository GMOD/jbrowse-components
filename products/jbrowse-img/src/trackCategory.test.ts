/**
 * @jest-environment jsdom
 */
import { getEnv } from '@jbrowse/core/util'
import {
  buildDisplaySnapshot,
  categorizedDisplayTypes,
  displayCategory,
} from '@jbrowse/launch-args/displaySettings'
import { openedDisplayType } from '@jbrowse/plugin-linear-genome-view'
import { createViewStateAsync } from '@jbrowse/react-app2'

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

function trackCategory(
  session: Parameters<typeof openedDisplayType>[0],
  trackId: string,
  opts: string[],
) {
  return displayCategory(openedDisplayType(session, trackId, opts))
}

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
    vcf: of('input.vcf'),
    gff: of('input.gff'),
    bigbed: of('input.bigbed'),
    bed: of('input.bed'),
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
    vcf: 'variant',
    gff: 'feature',
    bigbed: 'feature',
    bed: 'feature',
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
  expect(trackCategory(session, 'input.vcf', ['display:multivariant'])).toBe(
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
      expect(buildDisplaySnapshot('LinearMafDisplay', [opt]).snap).toEqual({})
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('has no effect on this track type'),
      )
    },
  )

  test('height, force and a constant color still apply', () => {
    expect(
      buildDisplaySnapshot('LinearMafDisplay', [
        'height:200',
        'force',
        'color:strand',
      ]).snap,
    ).toEqual({
      height: 200,
      forceLoad: true,
      encoding: { color: { value: 'strand' } },
    })
  })
})

describe('a modifier lands only where the display declares its slot', () => {
  const warn = jest.fn()
  afterEach(() => {
    warn.mockClear()
  })

  test.each([
    ['heightMode:fit', 'LinearMultiRowFeatureDisplay', 'heightMode'],
    ['featureHeight:3', 'LinearMultiRowFeatureDisplay', 'mark.height'],
  ])('%s on %s warns, naming %s', (opt, displayType, slot) => {
    expect(buildDisplaySnapshot(displayType, [opt], warn).snap).toEqual({})
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `no effect on ${displayType}, which has no ${slot}`,
      ),
    )
  })

  test('force: is skipped unsaid on a display that never gates', () => {
    for (const displayType of ['LinearWiggleDisplay', 'LinearHicDisplay']) {
      expect(
        buildDisplaySnapshot(displayType, ['force:true'], warn).snap,
      ).toEqual({})
    }
    expect(warn).not.toHaveBeenCalled()
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['force:true'], warn)
        .snap,
    ).toEqual({ forceLoad: true })
  })

  test('the same modifiers still write where the display declares them', () => {
    expect(
      buildDisplaySnapshot(
        'LinearBasicDisplay',
        ['heightMode:fit', 'featureHeight:3'],
        warn,
      ).snap,
    ).toEqual({ heightMode: 'fit', mark: { height: 3 } })
    expect(warn).not.toHaveBeenCalled()
  })
})
